function getSvgStyles() {
    let css = '';
    for (const sheet of document.styleSheets) {
        try {
            for (const rule of sheet.cssRules) {
                if (rule.cssText) {
                    css += rule.cssText;
                }
            }
        } catch (e) {
            console.warn("Cannot read cross-origin stylesheet", e);
        }
    }
    return css;
}

function createDownloadLink(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function serializeSvgWithStyles(svgElement) {
    const clone = svgElement.cloneNode(true);
    const styles = getSvgStyles();

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;

    clone.insertBefore(styleElement, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svgElement, filename) {
    if (!svgElement) return;
    const svgString = serializeSvgWithStyles(svgElement);
    createDownloadLink(filename, svgString, 'image/svg+xml');
}

export function exportPng(svgElement, filename) {
    if (!svgElement) return;

    const svgString = serializeSvgWithStyles(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // Render at 2x resolution for better quality
        canvas.width = svgElement.getBoundingClientRect().width * scale;
        canvas.height = svgElement.getBoundingClientRect().height * scale;
        const ctx = canvas.getContext('2d');

        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        const pngUrl = canvas.toDataURL('image/png');
        createDownloadLink(filename, pngUrl, 'image/png');
        URL.revokeObjectURL(url);
    };

    img.onerror = (e) => {
        console.error("Could not load SVG into image", e);
        URL.revokeObjectURL(url);
        alert("Sorry, the image could not be exported.");
    };

    img.src = url;
}