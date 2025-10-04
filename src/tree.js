import * as d3 from 'd3';
import NJ from 'neighbor-joining';

let treeG, taxa, nodeColor;

export function initTree(svg, initialTaxa, colorScale) {
    taxa = initialTaxa;
    nodeColor = colorScale;
    svg.selectAll("*").remove();

    treeG = svg.append("g");

    const zoomed = (event) => {
        treeG.attr("transform", event.transform);
    };

    const zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on("zoom", zoomed);

    svg.call(zoom);
}

function computeNJ(distMatrix) {
    if (!distMatrix) return null;
    const rnj = new NJ.RapidNeighborJoining(distMatrix, taxa, false, t => t.name);
    rnj.run();
    return rnj.getAsObject();
}

function convertHierarchyToNodesLinks(treeObj) {
    const nodes = [];
    const links = [];
    let counter = 0;

    function traverse(node, parentId) {
        const nodeId = counter++;
        nodes.push({ id: nodeId, data: node });

        if (parentId !== null) {
            links.push({
                source: parentId,
                target: nodeId,
                length: node.branch_length || 1
            });
        }

        if (node.children) {
            node.children.forEach(child => traverse(child, nodeId));
        }
    }

    traverse(treeObj, null);
    return { nodes, links };
}

function drawTree(treeObj) {
    if (!treeG || !treeObj) {
        if (treeG) treeG.selectAll("*").remove();
        return;
    }
    treeG.selectAll("*").remove();

    const { width, height } = treeG.node().parentElement.getBoundingClientRect();
    const { nodes, links } = convertHierarchyToNodesLinks(treeObj);

    const maxBranchLength = d3.max(links, d => d.length);
    const lengthScale = d3.scaleLinear()
        .domain([0, maxBranchLength])
        .range([10, 100]);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(d => lengthScale(d.length)))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .stop();

    simulation.tick(300);

    const link = treeG.append("g")
        .attr("stroke", "#555")
        .attr("stroke-width", 1.5)
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    const treeNode = treeG.append("g")
        .selectAll("g")
        .data(nodes)
        .enter().append("g")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    treeNode.append("circle")
        .attr("r", 14)
        .attr("fill", d => (d.data.children && d.data.children.length > 0) ? "#555" : nodeColor(d.data.taxon.name));

    treeNode.append("text")
        .attr("dy", "0.31em")
        .attr("x", 18)
        .style("font-size", "2em")
        .style("text-anchor", "start")
        .text(d => d.data.taxon?.name || "")
        .attr("class", "node-label");

    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    treeNode.call(drag(simulation));
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
            const srcName = taxa[i].name, tgtName = taxa[j].name, edge = totalDistances.find(d => {
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