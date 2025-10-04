import * as d3 from 'd3';

let beatLabel, loader;

export function initUI(elements, onFileLoad, onExampleLoad, onAnalysis, onExport) {
    beatLabel = document.getElementById('beatLabel');
    loader = document.getElementById('loader');
    const exportNetworkBtn = document.getElementById('exportNetworkBtn');
    const exportTreeBtn = document.getElementById('exportTreeBtn');
    const exportAxisBtn = document.getElementById('exportAxisBtn');

    const { loadBtn, exampleBtn, totalTreeBtn, totalNetworkBtn, resetViewBtn } = elements;
    if(loadBtn) loadBtn.onclick = onFileLoad;
    if(exampleBtn) exampleBtn.onclick = onExampleLoad;
    if(totalTreeBtn) totalTreeBtn.onclick = () => onAnalysis('total-tree');
    if(totalNetworkBtn) totalNetworkBtn.onclick = () => onAnalysis('total-network');
    if(resetViewBtn) resetViewBtn.onclick = () => onAnalysis('reset');
    if(exportNetworkBtn) exportNetworkBtn.onclick = () => onExport('network');
    if(exportTreeBtn) exportTreeBtn.onclick = () => onExport('tree');
}

export function showLoader() {
    if (loader) loader.style.display = 'flex';
}

export function hideLoader() {
    if (loader) loader.style.display = 'none';
}

export function updateStatusLabel(text) {
    if (beatLabel) beatLabel.textContent = text;
}

export function createLegends(axisColor) {
    const axisLegend = d3.select("#axis-legend");
    if (axisLegend.empty()) return;
    axisLegend.html("");
    axisLegend.append("strong").text("Differences per Beat:");
    const svg = axisLegend.append("svg").attr("height", 20).attr("width", "100%");
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient").attr("id", "gradient-axis");
    linearGradient.selectAll("stop")
        .data(axisColor.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: axisColor(t) })))
        .enter().append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);
    svg.append("rect").attr("width", "100%").attr("height", 15).style("fill", "url(#gradient-axis)");
    axisLegend.append("div").attr("class", "legend-labels").html(`<span>less</span><span>more</span>`);
}