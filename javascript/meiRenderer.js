// meiRenderer.js
// ──────────────────────────────────────────────────────────────────
//
// Exports functions to load MEI files, instantiate Verovio, and produce
// per‐measure SVG elements so you can embed them (e.g. in tooltips).
//
// Usage from main.js:
//
//   import { loadMEIFile, renderMeasureSVG, getMeasureCount } from './meiRenderer.js';
//
//   // When user picks new MEI file:
//   loadMEIFile(file).then(meiData => {
//     // meiData.toolkit is a Verovio toolkit instance
//     // meiData.totalMeasures is integer
//     // meiData.measureSVGs is an object { measureNum: <SVGNode>, … }
//   });
//

// Make sure you have verovio-toolkit.js available in the same folder or via CDN
// <script type="module" src="verovio-toolkit.js"></script> before importing this file,
// or dynamically load it via `import`.
// meiRenderer.js
// ──────────────────────────────────────────────────────────────────
//
// Renders individual‐measure SVGs by using Verovio’s `select({ measureRange })`
// before calling `renderToSVG()` without extra parameters.

export function loadMEIString(meiText, name) {
    // 1) Instantiate Verovio
    const vrvToolkit = new verovio.toolkit();
    vrvToolkit.setOptions({
        pageWidth: 300,
        pageHeight: 100,
        adjustPageHeight: true
        // (no 'label' option here)
    });
    vrvToolkit.loadData(meiText);

    // 2) Determine how many measures exist by trying select/render until empty
    let totalMeasures = 0;
    for (let m = 1; m < 500; m++) {
        try {
            // Select exactly measure m
            vrvToolkit.select({ measureRange: `${m}-${m}` });
            const svgString = vrvToolkit.renderToSVG(); // no extra params
            // If Verovio returned no music data, stop
            if (!svgString || svgString.includes("<!-- no music data -->")) {
                break;
            }
            totalMeasures = m;
        } catch {
            break;
        }
    }
    // 3) Cache each measure’s <svg> node
    const measureSVGs = {};
    for (let m = 1; m <= totalMeasures; m++) {
        vrvToolkit.select({ measureRange: `${m}-${m}` });
        const svgString = vrvToolkit.renderToSVG();
        const wrapper = document.createElement("div");
        wrapper.innerHTML = svgString;
        measureSVGs[m] = wrapper.querySelector("svg");
    }

    return { name, totalMeasures, measureSVGs };
}

export async function loadMEIFile(file) {
    const text = await file.text();
    // 1) Instantiate Verovio
    const vrvToolkit = new verovio.toolkit();
    vrvToolkit.setOptions({
        pageWidth: 1000,
        pageHeight: 200,
        adjustPageHeight: true
        // (dropped 'label' here)
    });
    vrvToolkit.loadData(text);

    // 2) Determine total measures by selecting each one until empty
    let totalMeasures = 0;
    for (let m = 1; m < 500; m++) {
        try {
            vrvToolkit.select({ measureRange: `${m}-${m}` });
            const svgString = vrvToolkit.renderToSVG();
            if (!svgString || svgString.includes("<!-- no music data -->")) {
                break;
            }
            totalMeasures = m;
        } catch {
            break;
        }
    }

    // 3) Cache each measure’s <svg> node
    const measureSVGs = {};
    for (let m = 1; m <= totalMeasures; m++) {
        vrvToolkit.select({ measureRange: `${m}-${m}` });
        const svgString = vrvToolkit.renderToSVG();
        const wrapper = document.createElement("div");
        wrapper.innerHTML = svgString;
        measureSVGs[m] = wrapper.querySelector("svg");
    }

    return { toolkit: vrvToolkit, totalMeasures, measureSVGs };
}


export function getMeasureCount(meiData) {
    return meiData.totalMeasures;
}

export function renderMeasureSVG(meiData, measureNumber) {
    // Return a deep clone of the stored SVG so we don’t move it out of the cache
    console.log(measureNumber+1, meiData)
    const original = meiData.measureSVGs[measureNumber+1];
    if (!original) return null;
    return original.cloneNode(true);
}
