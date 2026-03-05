function warmUpCanvasContexts() {
    const resolutionScales = [0.75, 0.8, 1.0];
    const canvases = [];

    resolutionScales.forEach(scale => {
        const width = 800 * scale; // assuming base width
        const height = 600 * scale; // assuming base height
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });

        // Draw a simple test pattern to enforce shader compilation
        context.fillStyle = 'orange';
        context.fillRect(0, 0, width, height);

        canvases.push(canvas);
    });

    // Dispose canvases
    canvases.forEach(canvas => {
        canvas.width = 0;
        canvas.height = 0;
    });
}