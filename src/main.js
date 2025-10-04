import * as d3 from 'd3';
import { initUI, showLoader, hideLoader, updateStatusLabel, createLegends } from './ui.js';
import { loadAndProcessData } from './data.js';
import { initAxisChart, updateAxisIndicator } from './axisChart.js';
import { initNetwork, updateNetwork } from './network.js';
import { initTree, updateTree, drawTotalTree } from './tree.js';
import { exportSvg, exportPng } from './export.js';

const App = {
    state: {},
    elements: {}
};

window.addEventListener('DOMContentLoaded', main);

function main() {
    App.elements = {
        netSvg: d3.select("#network"),
        treeSvg: d3.select("#tree"),
        axSvg: d3.select("#axis"),
        axisLabelContainer: d3.select("#axis-labels"),
        beatSlider: document.getElementById("beatSlider"),
        beatLabel: document.getElementById("beatLabel"),
        tooltip: d3.select("#tooltip"),
        fileInput: document.getElementById("diffFiles"),
    };

    initUI(
        {
            loadBtn: document.getElementById("loadBtn"),
            exampleBtn: document.getElementById("exampleBtn"),
            totalTreeBtn: document.getElementById("totalTreeBtn"),
            totalNetworkBtn: document.getElementById("totalNetworkBtn"),
            resetViewBtn: document.getElementById("resetViewBtn"),
        },
        () => handleFileUpload(App.elements.fileInput.files),
        handleExampleLoad,
        handleAnalysis,
        handleExport
    );

    App.elements.beatSlider.oninput = () => {
        if (App.state.isLiveView) setCurrentBeat(App.elements.beatSlider.value);
    };

    d3.selectAll('input[name="visType"]').on("change", () => {
        if (App.state.isLiveView) setCurrentBeat(App.elements.beatSlider.value);
    });
}

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;
    showLoader();
    try {
        App.state = await loadAndProcessData({ files });
        initializeAppWithData();
    } catch (error) {
        console.error("Fehler beim Verarbeiten der Dateien:", error);
    } finally {
        hideLoader();
    }
}

async function handleExampleLoad() {
    showLoader();
    try {
        App.state = await loadAndProcessData({ useExample: true });
        initializeAppWithData();
    } catch (error) {
        console.error("Fehler beim Laden der Beispieldaten:", error);
    } finally {
        hideLoader();
    }
}

function initializeAppWithData() {
    const { nodes, linkData, beatInfo, allBeatKeys, globalMax, nodeColor, axisColor, taxa } = App.state;
    const { netSvg, treeSvg, axSvg, axisLabelContainer, beatSlider, tooltip } = App.elements;

    createLegends(axisColor);

    const beatX = initAxisChart(axSvg, axisLabelContainer, tooltip, linkData, allBeatKeys, beatInfo, globalMax, axisColor, nodeColor, setCurrentBeat);
    App.state.beatX = beatX;

    initNetwork(netSvg, nodes, linkData, nodeColor);
    initTree(treeSvg, taxa, nodeColor);

    App.state.taxa = taxa;
    App.state.isLiveView = true;

    beatSlider.min = 0;
    beatSlider.max = allBeatKeys.length > 0 ? allBeatKeys.length - 1 : 0;
    beatSlider.disabled = false;

    setCurrentBeat(0);
}

function setCurrentBeat(idx) {
    if (!App.state.allBeatKeys || App.state.allBeatKeys.length === 0) return;
    const { allBeatKeys, beatInfo, beatX, linkData, globalMax, taxa } = App.state;
    const { netSvg, treeSvg, beatSlider } = App.elements;
    idx = Math.max(0, Math.min(allBeatKeys.length - 1, +idx));

    updateStatusLabel(`Live-View | Measure: ${beatInfo[allBeatKeys[idx]].measure}, Beat: ${beatInfo[allBeatKeys[idx]].beat.toFixed(2)}`);
    updateAxisIndicator(idx, beatX);
    beatSlider.value = idx;

    const activeVis = document.querySelector('input[name="visType"]:checked').value;
    if (activeVis === 'network') {
        netSvg.style("display", "block");
        treeSvg.style("display", "none");
        updateNetwork(idx, linkData, globalMax);
    } else {
        netSvg.style("display", "none");
        treeSvg.style("display", "block");
        updateTree(idx, linkData, taxa);
    }
}

function handleAnalysis(type) {
    const { netSvg, treeSvg, beatSlider } = App.elements;
    App.state.isLiveView = false;
    beatSlider.disabled = true;
    updateAxisIndicator(null, null);

    if (type === 'total-network') {
        updateStatusLabel("Total View (Network)");
        netSvg.style("display", "block");
        treeSvg.style("display", "none");
        updateNetwork(null, App.state.linkData, App.state.globalMax, true);
    } else if (type === 'total-tree') {
        updateStatusLabel("Total View (Tree)");
        netSvg.style("display", "none");
        treeSvg.style("display", "block");
        drawTotalTree(App.state.linkData, App.state.taxa);
    } else if (type === 'reset') {
        App.state.isLiveView = true;
        beatSlider.disabled = false;
        setCurrentBeat(beatSlider.value);
    }
}
function handleExport(type) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;

    if (type === 'network') {
        exportSvg(App.elements.netSvg.node(), `network-${timestamp}.svg`);
    } else if (type === 'tree') {
        exportSvg(App.elements.treeSvg.node(), `tree-${timestamp}.svg`);
    } else if (type === 'axis') {
        exportPng(App.elements.axSvg.node(), `axis-${timestamp}.png`);
    }
}