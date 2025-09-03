import * as d3 from 'd3';
import NJ from 'neighbor-joining';

let treeG, taxa, nodeColor;

export function initTree(svg, initialTaxa, colorScale) {
    taxa = initialTaxa;
    nodeColor = colorScale;
    svg.selectAll("*").remove();
    treeG = svg.append("g");
}

function computeNJ(distMatrix) {
    if (!distMatrix) return null;
    const rnj = new NJ.RapidNeighborJoining(distMatrix, taxa, false, t => t.name);
    rnj.run();
    return rnj.getAsObject();
}

function drawTree(treeObj) {
    if (!treeG || !treeObj) {
        if(treeG) treeG.selectAll("*").remove();
        return;
    };
    treeG.selectAll("*").remove();

    const { width, height } = treeG.node().parentElement.getBoundingClientRect();
    const root = d3.hierarchy(treeObj, d => d.children);

    // Das Layout nutzt jetzt einen festen Rand von 20px
    const layout = d3.tree().size([height - 40, width - 200]);
    layout(root);

    // Der Baum wird jetzt mit einem einfachen translate zentriert
    treeG.attr("transform", `translate(80, 20)`);

    treeG.selectAll("path.link")
        .data(root.links())
        .enter().append("path")
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x));

    const treeNode = treeG.selectAll("g.node")
        .data(root.descendants())
        .enter().append("g")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    treeNode.append("circle")
        .attr("r", 4.5)
        .attr("fill", d => d.children ? "#555" : nodeColor(d.data.taxon.name));

    treeNode.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d.children ? -10 : 10)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.taxon?.name || "")
        .attr("class", "node-label");
}

function getDistMatrixForBeat(idx, linkData) {
    const nNodes = () => taxa ? taxa.length : 0;
    const D = Array.from({ length: nNodes() }, () => Array(nNodes()).fill(0));
    for (let i = 0; i < nNodes(); i++) {
        for (let j = i + 1; j < nNodes(); j++) {
            const srcName = taxa[i].name;
            const tgtName = taxa[j].name;

            const edge = linkData.find(d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return (sourceId === srcName && targetId === tgtName) || (targetId === srcName && sourceId === tgtName);
            });

            const c = edge ? (edge.beatCounts[idx] || 0) : 0;
            D[i][j] = D[j][i] = c;
        }
    }
    return D;
}

export function updateTree(idx, linkData, currentTaxa) {
    taxa = currentTaxa;
    const distMatrix = getDistMatrixForBeat(idx, linkData);
    const treeObj = computeNJ(distMatrix);
    drawTree(treeObj);
}

export function drawTotalTree(linkData, currentTaxa) {
    taxa = currentTaxa;
    const nNodes = () => taxa ? taxa.length : 0;
    const totalDistances = linkData.map(link => ({
        ...link,
        totalDiffs: d3.sum(Object.values(link.beatCounts))
    }));

    const D = Array.from({ length: nNodes() }, () => Array(nNodes()).fill(0));
    for (let i = 0; i < nNodes(); i++) {
        for (let j = i + 1; j < nNodes(); j++) {
            const srcName = taxa[i].name;
            const tgtName = taxa[j].name;

            const edge = totalDistances.find(d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return (sourceId === srcName && targetId === tgtName) || (targetId === srcName && sourceId === tgtName);
            });

            D[i][j] = D[j][i] = edge ? edge.totalDiffs : 0;
        }
    }

    const treeObj = computeNJ(D);
    drawTree(treeObj);
}