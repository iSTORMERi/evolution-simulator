// src/world/BiomeHighlightFilter.ts

import * as PIXI from 'pixi.js';

const fragmentShader = `
precision highp float;

varying vec2 vTextureCoord;

uniform sampler2D uTexture;      // Текстура визуальной карты
uniform sampler2D uMaskTexture;  // Текстура маски биомов
uniform vec3 uTargetColor;       // RGB цвет искомого биома
uniform float uEnabled;          // 1.0 если подсвечивание включено
uniform vec2 uTextureSize;       // Размеры маски в пикселях

void main() {
    vec4 color = texture2D(uTexture, vTextureCoord);
    
    // Если подсветка отключена, возвращаем исходный цвет
    if (uEnabled < 0.5) {
        gl_FragColor = color;
        return;
    }

    vec4 maskColor = texture2D(uMaskTexture, vTextureCoord);
    
    // Сравниваем цвет пикселя маски с целевым цветом биома
    float dist = distance(maskColor.rgb, uTargetColor);
    bool isTargetBiome = dist < 0.22;

    if (isTargetBiome) {
        // Шаг проверки соседних пикселей для отрисовки границы
        vec2 step = vec2(2.0 / uTextureSize.x, 2.0 / uTextureSize.y);

        float dLeft  = distance(texture2D(uMaskTexture, vTextureCoord + vec2(-step.x, 0.0)).rgb, uTargetColor);
        float dRight = distance(texture2D(uMaskTexture, vTextureCoord + vec2(step.x, 0.0)).rgb, uTargetColor);
        float dTop   = distance(texture2D(uMaskTexture, vTextureCoord + vec2(0.0, -step.y)).rgb, uTargetColor);
        float dBot   = distance(texture2D(uMaskTexture, vTextureCoord + vec2(0.0, step.y)).rgb, uTargetColor);

        bool isEdge = (dLeft >= 0.22) || (dRight >= 0.22) || (dTop >= 0.22) || (dBot >= 0.22);

        if (isEdge) {
            // Неоновый бирюзовый контур выделенного биома
            gl_FragColor = vec4(0.1, 0.95, 1.0, 1.0);
        } else {
            // Подсвечивающая заливка для выбранной зоны
            vec3 highlight = mix(color.rgb, vec3(0.0, 0.65, 1.0), 0.45);
            gl_FragColor = vec4(highlight, color.a);
        }
    } else {
        // Оставляем остальные биомы без изменений
        gl_FragColor = color;
    }
}
`;

export class BiomeHighlightFilter extends PIXI.Filter {
  private group: PIXI.UniformGroup;

  constructor(maskTexture: PIXI.Texture, maskWidth: number, maskHeight: number) {
    const glProgram = PIXI.GlProgram.from({
      vertex: PIXI.defaultFilterVert,
      fragment: fragmentShader,
    });

    // В PixiJS v8 в UniformGroup передаются только чистые значения (numbers, arrays)
    const group = new PIXI.UniformGroup({
      uTargetColor: { value: new Float32Array([0, 0, 0]), type: 'vec3' },
      uEnabled: { value: 0.0, type: 'f' },
      uTextureSize: { value: new Float32Array([maskWidth, maskHeight]), type: 'vec2' },
    });

    // Текстура маски передается напрямую в resources через source
    super({
      glProgram,
      resources: {
        highlightUniforms: group,
        uMaskTexture: maskTexture.source,
      },
    });

    this.group = group;
  }

  public setHighlightedZone(hexColor: string | null): void {
    if (!hexColor) {
      this.group.uniforms.uEnabled = 0.0;
      this.group.update();
      return;
    }

    const cleanHex = hexColor.replace('#', '');
    
    if (cleanHex.length !== 6) {
      console.warn('Некорректный формат цвета биома:', hexColor);
      return;
    }

    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    this.group.uniforms.uTargetColor = new Float32Array([r, g, b]);
    this.group.uniforms.uEnabled = 1.0;
    
    this.group.update();
  }
}
