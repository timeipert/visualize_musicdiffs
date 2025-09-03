import * as d3 from 'd3';

let simulation, link, node, width, height;

export function initNetwork(svg, nodes, linkData, nodeColor) {
    width = svg.node().getBoundingClientRect().width;
    height = svg.node().getBoundingClientRect().height;

    svg.selectAll("*").remove();

    simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(linkData).id(d => d.id))
        .force("x", d3.forceX(width / 2).strength(0.1))
        .force("y", d3.forceY(height / 2).strength(0.1));

    link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(linkData)
        .join("line")
        .attr("stroke-width", 1.5);

    // KORREKTUR: Der weiße Rand wird nur dem Kreis zugewiesen, nicht der ganzen Gruppe
    node = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g");

    node.append("circle")
        .attr("r", 8)
        .attr("fill", d => nodeColor(d.id))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);

    node.append("text")
        .text(d => d.id)
        .attr("x", 12)
        .attr("y", 3)
        .attr("class", "node-label");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });
}

export function updateNetwork(idx, linkData, globalMax, isTotal = false) {
    if (!simulation) return;

    if (isTotal) {
        const totalDistances = linkData.map(link => ({
            ...link,
            totalDiffs: d3.sum(Object.values(link.beatCounts))
        }));
        const globalTotalMax = d3.max(totalDistances, d => d.totalDiffs) || 1;
        const computeTotalSimilarity = (d) => 1 - (d.totalDiffs / globalTotalMax);

        simulation.force("link").links(totalDistances).distance(d => {
            const sim = computeTotalSimilarity(d);
            return 60 + (1 - sim) * 240;
        });
    } else {
        const computeSimilarity = (d, beatIdx) => 1 - ((d.beatCounts[beatIdx] || 0) / globalMax);

        simulation.force("link").links(linkData).distance(d => {
            const sim = computeSimilarity(d, idx);
            return 60 + (1 - sim) * 240;
        });
    }
    simulation.alpha(1).restart();
}