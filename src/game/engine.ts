import * as pc from 'playcanvas';

export async function createApp(canvas: HTMLCanvasElement): Promise<pc.Application> {
  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    keyboard: new pc.Keyboard(window),
    touch: new pc.TouchDevice(canvas),
    graphicsDeviceOptions: {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    },
  });
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 2);
  const resize = () => app.resizeCanvas();
  window.addEventListener('resize', resize);
  app.start();
  return app;
}
