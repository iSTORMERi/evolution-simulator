// src/world/BiomeHighlightFilter.ts

import * as PIXI from 'pixi.js';

const fragmentShader = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;      // Текстура визуальной карты
uniform sampler2D uMaskTexture;  // Текстура маски биомов
uniform vec3 uTargetColor;       // RGB цвет искомого биома
uniform float uEnabled;          // 1.0 если подсвечивание включено, 0.0 если выключено
uniform vec2 uTextureSize;       // Размеры маски в пикселях

void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    
    // ТЕСТ-ДИАГНОСТИКА: Если флаг uEnabled доходит до GPU -- заливаем карту ярко-красным
    if (uEnabled > 0.5) {
        finalColor = vec4(1.0, 0.0, 0.0, 1.0);
    } else {
        finalColor = color;
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
