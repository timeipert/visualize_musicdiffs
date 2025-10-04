import * as d3 from 'd3';

const PRESET_DIFFS = [ "1803_BdA_ED_Op33_1.mei_1808_Zulehner_Op33_1.mei.txt", "1803_BdA_ED_Op33_1.mei_1825_Andre_Op33_1.mei.txt", "1803_BdA_ED_Op33_1.mei_1826_Schott_Op33_1.mei.txt", "1803_BdA_ED_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt", "1803_BdA_ED_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt", "1808_Zulehner_Op33_1.mei_1825_Andre_Op33_1.mei.txt", "1808_Zulehner_Op33_1.mei_1826_Schott_Op33_1.mei.txt", "1808_Zulehner_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt", "1808_Zulehner_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt", "1825_Andre_Op33_1.mei_1826_Schott_Op33_1.mei.txt", "1825_Andre_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt", "1825_Andre_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt", "1826_Schott_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt", "1826_Schott_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt", "1845_Haslinger_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt" ];

async function fetchData(config) {
    if (config.useExample) {
        const promises = PRESET_DIFFS.map(name => {
            const path = `${import.meta.env.BASE_URL}example/diffs/${name}`;
            return fetch(path).then(res => {
                if (!res.ok) throw new Error(`Datei nicht gefunden: ${path}`);
                return res.text();
            });
        });
        return Promise.all(promises);
    } else {
        return Promise.all([...config.files].map(file => file.text()));
    }
}

function parseAndProcess(rawDiffs) {
    let beatInfo = {};
    let nodesMap = {};
    let edges = [];
    rawDiffs.forEach(text => {
        const lines = text.split("\n");
        const a = lines[0].replace(/--- (.*\/)?/, "").replace(".mei", ""), b = lines[1].replace(/\+\+\+ (.*\/)?/, "").replace(".mei", "");
        if (!nodesMap[a]) nodesMap[a] = { id: a };
        if (!nodesMap[b]) nodesMap[b] = { id: b };
        const edge = { source: a, target: b, beatCounts: {}, beatDetails: {} };
        let curKeyStr = null;
        lines.forEach(line => {
            if (line.startsWith("@@")) {
                const m = /measure\s+(\d+),.*beat\s+([\d.]+)/.exec(line);
                if (m) {
                    const M = parseInt(m[1], 10), B = parseFloat(m[2]);
                    curKeyStr = `${M}-${B}`;
                    if (!beatInfo[curKeyStr]) beatInfo[curKeyStr] = { measure: M, beat: B };
                }
            } else if (curKeyStr && (line.startsWith("+") || line.startsWith("-"))) {
                edge.beatCounts[curKeyStr] = (edge.beatCounts[curKeyStr] || 0) + 1;
                if (!edge.beatDetails[curKeyStr]) edge.beatDetails[curKeyStr] = [];
                edge.beatDetails[curKeyStr].push(line);
            }
        });
        edges.push(edge);
    });

    const allParsedBeatKeys = Object.keys(beatInfo);
    if (allParsedBeatKeys.length > 0) {
        const beatsByMeasure = {};
        allParsedBeatKeys.forEach(keyStr => {
            const info = beatInfo[keyStr];
            if (!beatsByMeasure[info.measure]) beatsByMeasure[info.measure] = new Set();
            beatsByMeasure[info.measure].add(info.beat);
        });

        Object.entries(beatsByMeasure).forEach(([mStr, beatSet]) => {
            const M = parseInt(mStr, 10);
            const beatsArr = Array.from(beatSet).sort((a, b) => a - b);
            if (beatsArr.length > 1) {
                const diffs = beatsArr.slice(1).map((beat, i) => beat - beatsArr[i]);
                const step = Math.min(...diffs.filter(d => d > 1e-9));
                if (step > 0 && isFinite(step)) {
                    const minB = beatsArr[0], maxB = beatsArr[beatsArr.length - 1];
                    const nSteps = Math.round((maxB - minB) / step);
                    for (let i = 0; i <= nSteps; i++) {
                        const B = +((minB + i * step).toFixed(6));
                        const keyStr = `${M}-${B}`;
                        if (!beatInfo[keyStr]) beatInfo[keyStr] = { measure: M, beat: B };
                    }
                }
            }
        });
    }

    let allBeatKeys = Object.keys(beatInfo).filter(key => beatInfo[key] && typeof beatInfo[key].measure !== 'undefined');

    allBeatKeys.sort((a, b) => {
        const [mA, bA] = a.split("-").map(Number);
        const [mB, bB] = b.split("-").map(Number);
        return mA !== mB ? mA - mB : bA - bB;
    });

    const beatIndex = {};
    allBeatKeys.forEach((keyStr, i) => beatIndex[keyStr] = i);

    const linkData = edges.map(e => {
        const newCounts = {}, newDetails = {};
        Object.entries(e.beatCounts).forEach(([keyStr, count]) => {
            const idx = beatIndex[keyStr];
            if (typeof idx !== 'undefined') {
                newCounts[idx] = count;
                newDetails[idx] = e.beatDetails[keyStr] || [];
            }
        });
        return { id: `${e.source}__${e.target}`, source: e.source, target: e.target, beatCounts: newCounts, beatDetails: newDetails };
    });

    const nodes = Object.values(nodesMap);
    const taxa = nodes.map(d => ({ name: d.id }));
    const nodeColor = d3.scaleOrdinal(d3.schemeCategory10).domain(nodes.map(d => d.id));
    const globalMax = d3.max(linkData, d => d3.max(Object.values(d.beatCounts))) || 1;
    const axisColor = d3.scaleSequential(d3.interpolateReds).domain([0, globalMax]);

    return { nodes, taxa, linkData, beatInfo, allBeatKeys, globalMax, nodeColor, axisColor };
}

export async function loadAndProcessData(config) {
    const rawDiffs = await fetchData(config);
    return parseAndProcess(rawDiffs);
}