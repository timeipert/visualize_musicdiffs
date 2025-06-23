// diffParser.js
// ──────────────────────────────────────────────────────────────────
//
// Exports functions to parse raw diff‐text into:
//   •  nodesMap: { [fileID]: { id: fileID }, … }
//   •  edges: [ { source, target, beatCounts: { "M-B": count, … },
//                       beatDetails: { "M-B": [lines…], … } }, … ]
//   •  beatInfo: { "M-B": { measure: M, beat: B }, … }
//   •  diffByBeat: { "M-B": totalCountAcrossAllEdges, … }
//
// Usage from main.js:
//   import { parseDiffText, getParsedData } from './diffParser.js';
//
//   // inside your file‐reader callback:
//   parseDiffText(textOfThisFile);
//   // …after loading all files…
//   const { nodesMap, edges, beatInfo, diffByBeat } = getParsedData();
//

let diffByBeat = {};
let beatInfo   = {};
let edges      = [];
let nodesMap   = {};

export function parseDiffText(text) {
    const lines = text.split('\n');
    const a = lines[0].replace(/--- (\/.*)\//, ""),
        b = lines[1].replace(/\+\+\+ (\/.*)\//, "");

    if (!nodesMap[a]) nodesMap[a] = { id: a };
    if (!nodesMap[b]) nodesMap[b] = { id: b };

    const edge = { source: a, target: b, beatCounts: {}, beatDetails: {} };
    let curKeyStr = null;

    lines.forEach(line => {
        if (line.startsWith('@@')) {
            const m = /measure\s+(\d+),.*beat\s+([\d.]+)/.exec(line);
            if (m) {
                const M = parseInt(m[1], 10),
                    B = parseFloat(m[2]),
                    keyStr = `${M}-${B}`;
                curKeyStr = keyStr;
                if (!beatInfo[keyStr]) {
                    beatInfo[keyStr] = { measure: M, beat: B };
                    diffByBeat[keyStr] = 0;
                }
            }
        } else if (
            curKeyStr !== null &&
            (line.startsWith('+') || line.startsWith('-'))
        ) {
            edge.beatCounts[curKeyStr] = (edge.beatCounts[curKeyStr] || 0) + 1;
            diffByBeat[curKeyStr] = (diffByBeat[curKeyStr] || 0) + 1;
            if (!edge.beatDetails[curKeyStr]) edge.beatDetails[curKeyStr] = [];
            edge.beatDetails[curKeyStr].push(line);
        }
    });

    edges.push(edge);
}

export function getParsedData() {
    // Return copies so consumers can’t mutate our internals by accident:
    return {
        nodesMap:   Object.assign({}, nodesMap),
        edges:      edges.map(e => Object.assign({}, e)),
        beatInfo:   Object.assign({}, beatInfo),
        diffByBeat: Object.assign({}, diffByBeat)
    };
}