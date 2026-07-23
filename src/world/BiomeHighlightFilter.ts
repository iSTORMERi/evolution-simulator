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
    
    if (uEnabled < 0.5) {
        finalColor = color;
        return;
    }

    vec4 maskColor = texture(uMaskTexture, vTextureCoord);
    
    // Проверяем, совпадает ли цвет текущего пикселя маски с искомым биомом
    float dist = distance(maskColor.rgb, uTargetColor);
    bool isTargetBiome = dist < 0.15; // Небольшой допуск по цвету

    if (isTargetBiome) {
        // Шаг сетки для проверки соседних пикселей (поиск границы)
        vec2 step = vec2(1.5 / uTextureSize.x, 1.5 / uTextureSize.y);

        float dLeft  = distance(texture(uMaskTexture, vTextureCoord + vec2(-step.x, 0.0)).rgb, uTargetColor);
        float dRight = distance(texture(uMaskTexture, vTextureCoord + vec2(step.x, 0.0)).rgb, uTargetColor);
        float dTop   = distance(texture(uMaskTexture, vTextureCoord + vec2(0.0, -step.y)).rgb, uTargetColor);
        float dBot   = distance(texture(uMaskTexture, vTextureCoord + vec2(0.0, step.y)).rgb, uTargetColor);

        bool isEdge = (dLeft >= 0.15) || (dRight >= 0.15) || (dTop >= 0.15) || (dBot >= 0.15);

        if (isEdge) {
            // Яркий неоновый контур границы биома
            finalColor = vec4(0.2, 0.85, 1.0, 1.0);
        } else {
            // Мягкая полупрозрачная подсвечивающая заливка
            vec3 highlight = mix(color.rgb, vec3(0.1, 0.6, 1.0), 0.35);
            finalColor = vec4(highlight, color.a);
        }
    } else {
        // Для остальных биомов слегка притеняем картинку для контраста
        finalColor = vec4(color.rgb * 0.75, color.a);
    }
}
`;

export class BiomeHighlightFilter extends PIXI.Filter {
  constructor(maskTexture: PIXI.Texture, maskWidth: number, maskHeight: number) {
    const glProgram = PIXI.GlProgram.from({
      vertex: PIXI.defaultFilterVert,
      fragment: fragmentShader,
    });

    super({
      glProgram,
      resources: {
        highlightUniforms: {
          uMaskTexture: { value: maskTexture, type: 't' },
          uTargetColor: { value: new Float32Array([0, 0, 0]), type: 'vec3' },
          uEnabled: { value: 0.0, type: 'f' },
          uTextureSize: { value: new Float32Array([maskWidth, maskHeight]), type: 'vec2' },
        },
      },
    });
  }

  public setHighlightedZone(hexColor: string | null): void {
    const uniforms = (this.resources as any).highlightUniforms.uniforms;
    
    if (!hexColor) {
      uniforms.uEnabled = 0.0;
      return;
    }

    // Конвертируем hex (#RRGGBB) в RGB float [0..1]
    const r = parseInt(hexColor.substring(1, 3), 16) / 255;
    const g = parseInt(hexColor.substring(3, 5), 16) / 255;
    const b = parseInt(hexColor.substring(5, 7), 16) / 255;

    uniforms.uTargetColor = new Float32Array([r, g, b]);
    uniforms.uEnabled = 1.0;
  }
}
