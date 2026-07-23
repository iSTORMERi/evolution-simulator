// src/world/BiomeHighlightFilter.ts

import * as PIXI from 'pixi.js';

const fragmentShader = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;      // Текстура визуальной карты
uniform sampler2D uMaskTexture;  // Текстура маски биомов
uniform vec3 uTargetColor;       // RGB цвет искомого биома (0.0 - 1.0)
uniform float uEnabled;          // 1.0 если подсвечивание включено, 0.0 если выключено
uniform vec2 uTextureSize;       // Размеры маски в пикселях

void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    
    // Если подсветка отключена, возвращаем исходный цвет
    if (uEnabled < 0.5) {
        finalColor = color;
        return;
    }

    vec4 maskColor = texture(uMaskTexture, vTextureCoord);
    
    // Сравниваем цвет пикселя маски с целевым цветом биома
    float dist = distance(maskColor.rgb, uTargetColor);
    bool isTargetBiome = dist < 0.22;

    if (isTargetBiome) {
        // Шаг проверки соседних пикселей для отрисовки границы
        vec2 step = vec2(2.0 / uTextureSize.x, 2.0 / uTextureSize.y);

        float dLeft  = distance(texture(uMaskTexture, vTextureCoord + vec2(-step.x, 0.0)).rgb, uTargetColor);
        float dRight = distance(texture(uMaskTexture, vTextureCoord + vec2(step.x, 0.0)).rgb, uTargetColor);
        float dTop   = distance(texture(uMaskTexture, vTextureCoord + vec2(0.0, -step.y)).rgb, uTargetColor);
        float dBot   = distance(texture(uMaskTexture, vTextureCoord + vec2(0.0, step.y)).rgb, uTargetColor);

        bool isEdge = (dLeft >= 0.22) || (dRight >= 0.22) || (dTop >= 0.22) || (dBot >= 0.22);

        if (isEdge) {
            // Яркий неоново-бирюзовый контур выделенного биома
            finalColor = vec4(0.1, 0.95, 1.0, 1.0);
        } else {
            // Сочная подсвечивающая заливка для выбранной зоны
            vec3 highlight = mix(color.rgb, vec3(0.0, 0.65, 1.0), 0.45);
            finalColor = vec4(highlight, color.a);
        }
    } else {
        // Затемняем неактивные биомы, чтобы активный сразу бросался в глаза
        finalColor = vec4(color.rgb * 0.55, color.a);
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

    const group = new PIXI.UniformGroup({
      uMaskTexture: { value: maskTexture, type: 't' },
      uTargetColor: { value: new Float32Array([0, 0, 0]), type: 'vec3' },
      uEnabled: { value: 0.0, type: 'f' },
      uTextureSize: { value: new Float32Array([maskWidth, maskHeight]), type: 'vec2' },
    });

    super({
      glProgram,
      resources: {
        highlightUniforms: group,
      },
    });

    this.group = group;
  }

  public setHighlightedZone(hexColor: string | null): void {
    if (!hexColor) {
      this.group.uniforms.uEnabled = 0.0;
      return;
    }

    // Парсим hex (#RRGGBB) в нормализованные RGB float [0..1]
    const r = parseInt(hexColor.substring(1, 3), 16) / 255;
    const g = parseInt(hexColor.substring(3, 5), 16) / 255;
    const b = parseInt(hexColor.substring(5, 7), 16) / 255;

    this.group.uniforms.uTargetColor = new Float32Array([r, g, b]);
    this.group.uniforms.uEnabled = 1.0;
  }
}
