import * as PIXI from 'pixi.js';

export class CurrentParticlesDebug {
  public container: PIXI.Container;

  constructor(..._args: any[]) {
    this.container = new PIXI.Container();
  }

  public update(_deltaSeconds: number): void {}

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
