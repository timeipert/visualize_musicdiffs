// networkRenderer.js
// ──────────────────────────────────────────────────────────────────
//
// Export a function to draw/update the force‐directed graph.  It takes:
//   •  a <svg> container (d3 selection) for the network
//   •  `nodes`: array of { id }
//   •  `linkData`: array of { id, source, target, beatCounts: { beatIdx: count }, … }
//   •  `beatX`: [ x-coordinate, … ] if you ever want to tie node positions to beatX
//   •  callback on hover to show tooltip content
//   •  a way to “update stroke‐widths” when the current beat changes.
//
// Usage from main.js:
//   import { renderNetwork, updateNetworkForBeat } from './networkRenderer.js';
//   // …once data ready…
//   const { updateForBeat } = renderNetwork({
//        container: d3.select('#network'),
//        nodes,
//        linkData,
//        beatX,
//        onHoverEdge: (edge, beatIdx, eventXY) => { showTooltip(...) }
//   });
//   // then whenever beat changes:
//   updateForBeat(newBeatIdx);
//


export function renderNetwork({
                                  container,    // d3 selection of <svg id="network">
                                  width,        // svg width
                                  height,       // svg height
                                  nodes,        // [ { id }, … ]
                                  linkData,     // [ { id, source, target, beatCounts: { idx: count }, … }, … ]
                                  onHoverEdge,  // callback(edgeDatum, beatIdx, [pageX, pageY])
                                  initialBeatIdx = 0
                              }) {
    // 1) Build force simulation
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(linkData).id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    // 2) Create link groups
    const linkGroups = container.selectAll('g.linkGroup')
        .data(linkData)
        .enter()
        .append('g')
        .attr('class', 'linkGroup');

    // (a) Invisible hit‐area
    linkGroups.append('line')
        .attr('class', 'hitarea')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 10);

    // (b) Visible colored line
    linkGroups.append('line')
        .attr('class', 'linkLine')
        .attr('stroke', d => d3.scaleOrdinal(d3.schemeCategory10)(d.id))
        .attr('stroke-width', 1);

    // 3) Build nodes
    const node = container.selectAll('circle.node')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('r', 8)
        .attr('fill', 'orange')
        .call(drag(simulation));

    const label = container.selectAll('text.nodeLabel')
        .data(nodes)
        .enter()
        .append('text')
        .attr('class', 'nodeLabel')
        .text(d => d.id)
        .attr('font-size', 12)
        .attr('dx', 12)
        .attr('dy', 4);

    // 4) Hover behavior on edges
    linkGroups
        .on('mouseover', (event, d) => {
            const [pageX, pageY] = [event.pageX, event.pageY];
            onHoverEdge(d, initialBeatIdx, [pageX, pageY]);
        })
        .on('mousemove', (event, d) => {
            const [pageX, pageY] = [event.pageX, event.pageY];
            onHoverEdge(d, initialBeatIdx, [pageX, pageY]);
        })
        .on('mouseout', () => {
            d3.select('#tooltip').style('display', 'none');
        });

    // 5) Ticking → update link positions, node positions
    simulation.on('tick', () => {
        linkGroups.selectAll('.hitarea')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        linkGroups.selectAll('.linkLine')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y)
            .attr('stroke-width', d => {
                const count = d.beatCounts[initialBeatIdx] || 0;
                return count;
            });

        node.attr('cx', d => d.x)
            .attr('cy', d => d.y);

        label.attr('x', d => d.x)
            .attr('y', d => d.y);
    });

    // 6) Expose an updateForBeat function
    function updateForBeat(beatIdx) {
        initialBeatIdx = beatIdx;
        linkGroups.selectAll('.linkLine')
            .transition().duration(200)
            .attr('stroke-width', d => d.beatCounts[beatIdx] || 0);
    }

    return {
        updateForBeat
    };
}

// Helper: drag behavior
function drag(simulation) {
    return d3.drag()
        .on('start', event => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        })
        .on('drag', event => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        })
        .on('end', event => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        });
}
