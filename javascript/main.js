import { parseDiffText, getParsedData } from "./diffParser.js";
import { renderAxis } from "./axisRenderer.js";
import { renderNetwork } from "./networkRenderer.js";
import { loadMEIFile, loadMEIString, renderMeasureSVG } from "./meiRenderer.js";

// 2) “Preset” filenames (edit as needed)
const PRESET_MEIS = [
    "1803_BdA_ED_Op33_1.mei",
    "1808_Zulehner_Op33_1.mei",
    "1825_Andre_Op33_1.mei",
    "1826_Schott_Op33_1.mei",
    "1845_Haslinger_Op33_1.mei",
    "1864_Breitkopf_Haertel_Op33_1.mei"
];
const PRESET_DIFFS = [
    "1803_BdA_ED_Op33_1.mei_1808_Zulehner_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1825_Andre_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1826_Schott_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1825_Andre_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1826_Schott_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1825_Andre_Op33_1.mei_1826_Schott_Op33_1.mei.txt",
    "1825_Andre_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1825_Andre_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1826_Schott_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1826_Schott_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1845_Haslinger_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt"
];

const fileInput = document.getElementById("diffFiles"),
    meiInput  = document.getElementById("meiFiles"),
    loadBtn   = document.getElementById("loadBtn"),
    netSvg    = d3.select("#network"),
    axSvg     = d3.select("#axis"),
    tooltip   = d3.select("#tooltip"),

    width     = +netSvg.attr("width"),
    height    = +netSvg.attr("height"),
    axHeight  = +axSvg.attr("height");

// 3) Global state variables
const meiMap = {};             // maps filename → { toolkit, totalMeasures, measureSVGs }
let allBeatKeys = null;        // sorted array of "M-B" strings, e.g. ["1-1","1-1.5",…]
let currentEdgeUnderCursor = null;
let lastMouseXY = [0, 0];

// 4) Click “Load” does exactly what it always did. We also expose loadPreset().
loadBtn.onclick = () => {
    // If user explicitly picked diff/meis, handle those as before:
    const files = fileInput.files;
    if (files.length > 0) {
        let loadedDiffs = 0;
        for (let f of files) {
            const reader = new FileReader();
            reader.onload = () => {
                parseDiffText(reader.result);
                if (++loadedDiffs === files.length) {
                    startVisualization();
                }
            };
            reader.readAsText(f);
        }
    }

    // If user also picked MEIs manually, load them into meiMap
    const meiFiles = meiInput.files;
    for (let f of meiFiles) {
        // We can just call loadMEIString on the raw text
        const reader = new FileReader();
        reader.onload = () => {
            meiMap[f.name] = loadMEIString(reader.result, f.name);
        };
        reader.readAsText(f);
    }
};

// 5) loadPreset(): fetch all preset MEIs + diffs automatically from known folders
export function loadPreset() {
    // 5a) Fetch MEIs from "./mei/<name>"
    const meiPromises = PRESET_MEIS.map((filename) =>
        fetch(`example/mei/${filename}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to fetch MEI ${filename}`);
                return res.text();
            })
            .then((text) => {
                // Store under meiMap[filename]
                meiMap[filename] = loadMEIString(text, filename);
            })
            .catch((err) => console.error(err))
    );

    // 5b) Once all MEIs are loaded, fetch the diffs from "./diff/<diffname>"
    Promise.all(meiPromises).then(() => {
        const diffPromises = PRESET_DIFFS.map((diffName) =>
            fetch(`example/diffs/${diffName}`)
                .then((res) => {
                    if (!res.ok) throw new Error(`Failed to fetch diff ${diffName}`);
                    return res.text();
                })
                .then((text) => {
                    parseDiffText(text);
                })
                .catch((err) => console.error(err))
        );

        // 5c) Once all diffs are parsed, start the visualization
        Promise.all(diffPromises).then(() => {
            startVisualization();
        });
    });
}

// 6) startVisualization(): exactly as before, except we rely on global allBeatKeys.
function startVisualization() {
    const { nodesMap, edges, beatInfo, diffByBeat } = getParsedData();

    // 6a) Zero‐fill any missing beats (exactly as before) …
    let beatsByMeasure = {};
    Object.entries(beatInfo).forEach(([k, info]) => {
        const M = info.measure, B = info.beat;
        if (!beatsByMeasure[M]) beatsByMeasure[M] = new Set();
        beatsByMeasure[M].add(B);
    });
    Object.entries(beatsByMeasure).forEach(([mStr, beatSet]) => {
        const M = parseInt(mStr, 10);
        let beatsArr = Array.from(beatSet).sort((a, b) => a - b);
        let step = 1.0;
        if (beatsArr.length > 1) {
            const diffs = [];
            for (let i = 1; i < beatsArr.length; i++) diffs.push(beatsArr[i] - beatsArr[i - 1]);
            step = Math.min(...diffs);
        }
        const minB = beatsArr[0], maxB = beatsArr[beatsArr.length - 1],
            nSteps = Math.round((maxB - minB) / step);
        for (let i = 0; i <= nSteps; i++) {
            const Bcur = +((minB + i * step).toFixed(6)),
                keyStr = `${M}-${Bcur}`;
            if (!beatInfo[keyStr]) {
                beatInfo[keyStr] = { measure: M, beat: Bcur };
                diffByBeat[keyStr] = 0;
                edges.forEach((e) => {
                    e.beatCounts[keyStr] = 0;
                    e.beatDetails[keyStr] = [];
                });
            }
        }
    });

    // 6b) Rebuild beatsByMeasure after zero‐fill
    beatsByMeasure = {};
    Object.entries(beatInfo).forEach(([k, info]) => {
        const M = info.measure, B = info.beat;
        if (!beatsByMeasure[M]) beatsByMeasure[M] = new Set();
        beatsByMeasure[M].add(B);
    });
    const distinctMeasures = Object.keys(beatsByMeasure)
        .map(Number)
        .sort((a, b) => a - b);
    const measureBeats = {};
    distinctMeasures.forEach((M) => {
        measureBeats[M] = Array.from(beatsByMeasure[M]).sort((a, b) => a - b);
    });

    // 6c) Build and sort allBeatKeys (global)
    allBeatKeys = Object.keys(beatInfo).slice();
    allBeatKeys.sort((a, b) => {
        const [mA, bA] = a.split("-").map(Number);
        const [mB, bB] = b.split("-").map(Number);
        if (mA !== mB) return mA - mB;
        return bA - bB;
    });

    // 6d) Build beatIndex and remap edges → integer‐based linkData
    const beatIndex = {};
    allBeatKeys.forEach((k, i) => (beatIndex[k] = i));
    const linkData = edges.map((e) => {
        const newCounts = {}, newDetails = {};
        Object.entries(e.beatCounts).forEach(([keyStr, c]) => {
            const idx = beatIndex[keyStr];
            newCounts[idx] = c;
            newDetails[idx] = e.beatDetails[keyStr] || [];
        });
        return {
            id: `${e.source}__${e.target}`,
            source: e.source,
            target: e.target,
            beatCounts: newCounts,
            beatDetails: newDetails,
        };
    });

    // 6e) Render axis
    const axisAPI = renderAxis({
        container: axSvg,
        width,
        height: axHeight,
        beatInfo,
        edges: linkData,
        distinctMeasures,
        measureBeats,
        allBeatKeys,
        beatIndex,
        onBeatHover: (beatIdx) => {
            if (currentEdgeUnderCursor) {
                showTooltip(currentEdgeUnderCursor, beatIdx, lastMouseXY);
            }
            networkAPI.updateForBeat(beatIdx);
        },
    });

    // 6f) Render network
    const nodes = Object.values(nodesMap);
    const networkAPI = renderNetwork({
        container: netSvg,
        width,
        height,
        nodes,
        linkData,
        onHoverEdge: (edgeDatum, beatIdx, [pageX, pageY]) => {
            currentEdgeUnderCursor = edgeDatum;
            lastMouseXY = [pageX, pageY];
            showTooltip(edgeDatum, beatIdx, [pageX, pageY]);
        },
        initialBeatIdx: axisAPI.getCurrentBeatIdx(),
    });

    // 6g) (Optional) If you still have a slider, wire it up to axisAPI & networkAPI…

    // 6h) Hide tooltip initially
    tooltip.style("display", "none");
}

// 7) showTooltip: exactly as described earlier
function showTooltip(edgeDatum, beatIdx, [pageX, pageY]) {
    // Get original "M-B" string
    const keyStr = allBeatKeys[beatIdx];
    const [measure, beat] = keyStr.split("-").map(Number);

    // Diff lines:
    const diffs = edgeDatum.beatDetails[beatIdx] || [];

    // Build diff text HTML
    let html = `<div style="margin-bottom:8px;">
                <strong>Edge ${edgeDatum.source} ↔ ${edgeDatum.target}</strong><br>
                Measure ${measure}, Beat ${beat.toFixed(2)} diffs:
              </div>`;
    if (diffs.length) {
        html += "<ul style='margin-top:0; margin-bottom:8px; padding-left:1em;'>";
        diffs.forEach((line) => {
            html += `<li><code>${line}</code></li>`;
        });
        html += "</ul>";
    } else {
        html += `<div style="margin-bottom:8px;"><em>(no diffs at this beat)</em></div>`;
    }

    // Lookup exactly the two MEI datasets for this edge’s endpoints
    const meiA = meiMap[edgeDatum.source.id.trim()];
    const meiB = meiMap[edgeDatum.target.id.trim()];
    console.log(meiA)

    // If MEI A exists, render measure M
    if (meiA) {
        const svgA = renderMeasureSVG(meiA, measure);
        console.log(svgA)
        if (svgA) {
            const wrapperA = document.createElement("div");
            wrapperA.style.display = "inline-block";
            wrapperA.style.verticalAlign = "top";
            wrapperA.style.marginRight = "8px";
            wrapperA.appendChild(svgA);
            html += `<div class="meia">${wrapperA.innerHTML}</div>`;
        }
    }

    // If MEI B exists, render measure M
    if (meiB) {
        const svgB = renderMeasureSVG(meiB, measure);
        if (svgB) {
            const wrapperB = document.createElement("div");
            wrapperB.style.display = "inline-block";
            wrapperB.style.verticalAlign = "top";
            wrapperB.appendChild(svgB);
            html += `<div class="meib">${wrapperB.innerHTML}</div>`;
        }
    }

    // Show the tooltip
    tooltip
        .html(html)
        .style("left", pageX + 10 + "px")
        .style("top", pageY + 10 + "px")
        .style("display", "block");
}

// 8) Optionally, call loadPreset() on page‐load (or wire it to a button)
window.addEventListener("DOMContentLoaded", () => {
    // Automatically start the preset load:
    loadPreset();
});
