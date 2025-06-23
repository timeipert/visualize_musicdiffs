// axisRenderer.js
// ──────────────────────────────────────────────────────────────────
//
// Exports a function to render the “vertical stack of bar‐panels” plus
//   •  a single shared Y‐scale (globalMax) across all panels
//   •  vertical grey lines marking each measure start
//   •  subdivided beats inside each measure block (equal‐width per measure)
//   •  transparent capture layer for “click to enable selection,” and “mousemove only when enabled”.
//
// Usage from main.js:
//   import { renderAxis, onBeatChange } from './axisRenderer.js';
//   …later…
/*
   renderAxis({
     container: d3.select('#axis'),
     width,
     height: axHeight,
     beatInfo,
     edges,          // un‐remapped edges (with "M-B" keys) or numeric edges
                     // (we’ll decide in main.js)
     nodesMap,
     onBeatHover: idx => { … },
     currentBeatIdx: someIndex
   });
*/


let currentBeatIdx = 0;

export function renderAxis({
                               container,      // d3‐selection of <svg id="axis">
                               width,
                               height,
                               beatInfo,       // { "M-B": { measure, beat }, … }
                               edges,          // use edges remapped so that edges[i].beatCounts uses integer keys
                               distinctMeasures,
                               measureBeats,   // { M: [ B1, B2, … ] }
                               allBeatKeys,    // [ "1-1", "1-2", … ]
                               beatIndex,      // { "M-B": index }
                               onBeatHover     // callback(beatIdx)
                           }) {
    // 1) Compute global max diff across all edges & all beats:
    const linkData = edges;
    const globalMax = d3.max(
        linkData.map(d =>
            d3.max(Object.values(d.beatCounts).length
                ? Object.values(d.beatCounts)
                : [0]
            )
        )
    ) || 0;

    // 2) Compute layout constants:
    const marginLeft = 40,
        marginRight = 40,
        innerWidth = width - marginLeft - marginRight,
        numMeasures = distinctMeasures.length,
        measureWidth = innerWidth / numMeasures,
        nEdges = linkData.length,
        panelHeight = height / nEdges,
        barWidth = 4;

    // 3) Precompute each beat’s absolute X‐coordinate:
    const beatX = new Array(allBeatKeys.length);
    allBeatKeys.forEach((keyStr, idx) => {
        const { measure: M, beat: B } = beatInfo[keyStr];
        const measureIndex = distinctMeasures.indexOf(M),
            beatsArr = measureBeats[M],
            beatIdxInMeasure = beatsArr.indexOf(B),
            numBeats = beatsArr.length;
        const xPos = marginLeft
            + measureIndex * measureWidth
            + (beatIdxInMeasure + 0.5) * (measureWidth / numBeats);
        beatX[idx] = xPos;
    });
    const beatXs = beatX.slice(); // sorted ascending

    // 4) Find “measure start” X’s:
    const measureStarts = distinctMeasures.map((_, mi) => marginLeft + mi * measureWidth);

    // 5) Build a D3 bisector for “snap to nearest beat”
    const bisect = d3.bisector(d => d).left;
    function findNearestIdx(mouseX) {
        let i = bisect(beatXs, mouseX);
        if (i === 0) return 0;
        if (i >= beatXs.length) return beatXs.length - 1;
        return (Math.abs(mouseX - beatXs[i - 1]) < Math.abs(mouseX - beatXs[i]))
            ? (i - 1)
            : i;
    }

    // 6) Draw everything:
    //    –  Clear prior contents:
    container.selectAll("*").remove();

    linkData.forEach((d, iEdge) => {
        const yScale = d3.scaleLinear()
            .domain([0, globalMax || 1])
            .range([panelHeight, 0]);

        const panelGroup = container.append("g")
            .attr("transform", `translate(0, ${iEdge * panelHeight})`);

        // (a) Baseline across all measures
        panelGroup.append("line")
            .attr("x1", marginLeft).attr("y1", panelHeight)
            .attr("x2", marginLeft + innerWidth).attr("y2", panelHeight)
            .attr("stroke", "#000");

        // (b) Grey measure‐start lines
        panelGroup.selectAll("line.measureStart")
            .data(measureStarts)
            .enter()
            .append("line")
            .attr("class", "measureStart")
            .attr("x1", d => d).attr("y1", 0)
            .attr("x2", d => d).attr("y2", panelHeight)
            .attr("stroke", "lightgrey")
            .attr("stroke-width", 1);

        // (c) Bars for each beat
        for (let beatIdx = 0; beatIdx < allBeatKeys.length; beatIdx++) {
            const c = d.beatCounts[beatIdx] || 0,
                xCenter = beatX[beatIdx],
                rectX = xCenter - barWidth / 2,
                y = yScale(c),
                h = panelHeight - y;
            panelGroup.append("rect")
                .attr("x", rectX)
                .attr("y", y)
                .attr("width", barWidth)
                .attr("height", h)
                .attr("fill", d3.schemeCategory10[iEdge % 10]);
        }

        // (d) Y‐axis (shared scale)
        const yAxis = d3.axisLeft(yScale).ticks(3);
        panelGroup.append("g")
            .attr("transform", `translate(${marginLeft}, 0)`)
            .call(yAxis);
    });

    // 7) Vertical “current‐beat” indicator
    const indicator = container.append("line")
        .attr("id", "beatIndicator")
        .attr("x1", beatX[currentBeatIdx])
        .attr("x2", beatX[currentBeatIdx])
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "blue")
        .attr("opacity", 0.5)
        .attr("stroke-width", 2);

    // 8) Enable click → toggle “selection mode”
    let isSelection = false;
    container.on("click", () => {
        isSelection = !isSelection;
    });

    // 9) Mousemove → if in selection mode, snap to nearest beat
    container.on("mousemove", (event) => {
        if (!isSelection) return;
        const [mouseX] = d3.pointer(event);
        const nearest = findNearestIdx(mouseX);
        setCurrentBeat(nearest);
    });

    // 10) Expose a function so main.js can update “currentBeatIdx”
    function setCurrentBeat(newIdx) {
        currentBeatIdx = newIdx;
        // Update indicator position
        indicator
            .attr("x1", beatX[newIdx])
            .attr("x2", beatX[newIdx]);

        // Fire callback so networkRenderer can change link widths & tooltip can update
        if (typeof onBeatHover === "function") {
            onBeatHover(newIdx);
        }
    }

    return {
        setCurrentBeat,        // call this from main.js or networkRenderer upon slider changes
        getBeatX: () => beatX, // for use in networkRenderer (stroke‐width snapping)
        getCurrentBeatIdx: () => currentBeatIdx
    };
}
