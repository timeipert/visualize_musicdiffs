import * as d3 from 'd3';

let indicator;

/**
 * Initialisiert die Achsen-Visualisierung und zeichnet sie.
 * @returns {Array} Das Array mit den berechneten x-Positionen für jeden Beat.
 */
export function initAxisChart(axSvg, tooltip, linkData, allBeatKeys, beatInfo, globalMax, axisColor, setCurrentBeat) {
    axSvg.selectAll("*").remove();

    if (!allBeatKeys || allBeatKeys.length === 0 || !linkData || linkData.length === 0) {
        axSvg.append("text").attr("x", 20).attr("y", 20).text("Keine Daten zum Anzeigen.").attr("fill", "#999");
        return [];
    }

    const containerWidth = axSvg.node().parentElement.getBoundingClientRect().width;
    const marginLeft = 150, marginRight = 40;
    const distinctMeasures = [...new Set(Object.values(beatInfo).map(info => info.measure))].sort((a,b)=>a-b);

    // Die Breite wird jetzt auf Basis einer minimalen Breite pro Takt berechnet, um genug Platz zu schaffen.
    const axisWidth = Math.max(containerWidth, distinctMeasures.length * 100); // 100px pro Takt
    axSvg.attr("width", axisWidth);

    const innerWidth = axisWidth - marginLeft - marginRight;
    const measureWidth = innerWidth / distinctMeasures.length;

    const beatsByMeasure = {};
    allBeatKeys.forEach(keyStr => {
        const info = beatInfo[keyStr];
        if (info && typeof info.measure !== 'undefined') {
            if (!beatsByMeasure[info.measure]) beatsByMeasure[info.measure] = new Set();
            beatsByMeasure[info.measure].add(info.beat);
        }
    });

    const beatPositions = [];
    allBeatKeys.forEach((keyStr, idx) => {
        const info = beatInfo[keyStr];
        if (!info) return;
        const measureIndex = distinctMeasures.indexOf(info.measure);
        const beatsInMeasure = Array.from(beatsByMeasure[info.measure] || []).sort((a,b) => a-b);
        const beatIdxInMeasure = beatsInMeasure.indexOf(info.beat);
        if (measureIndex > -1 && beatIdxInMeasure > -1) {
            const x = marginLeft + measureIndex * measureWidth + (beatIdxInMeasure + 0.5) * (measureWidth / beatsInMeasure.length);
            beatPositions.push({ idx, x });
        }
    });

    const beatX = Array(allBeatKeys.length);
    beatPositions.forEach(pos => { beatX[pos.idx] = pos.x; });

    const panelHeight = Math.max(20, 200 / linkData.length);
    const totalHeight = linkData.length * panelHeight;
    axSvg.attr("height", totalHeight);

    indicator = axSvg.append("line")
        .attr("stroke", "blue").attr("stroke-width", 1.5).attr("opacity", 0.7)
        .style("pointer-events", "none").attr("y1", 0).attr("y2", totalHeight);

    linkData.forEach((d, i) => {
        const panelGroup = axSvg.append("g").attr("transform", `translate(0, ${i * panelHeight})`);
        const yScale = d3.scaleLinear().domain([0, globalMax]).range([panelHeight, 0]);
        panelGroup.selectAll("rect").data(d3.range(allBeatKeys.length)).join("rect")
            .attr("x", keyIdx => beatX[keyIdx] ? beatX[keyIdx] - 2 : -10)
            .attr("y", keyIdx => yScale(d.beatCounts[keyIdx] || 0))
            .attr("width", 4).attr("height", keyIdx => panelHeight - yScale(d.beatCounts[keyIdx] || 0))
            .attr("fill", keyIdx => (d.beatCounts[keyIdx] || 0) > 0 ? axisColor(d.beatCounts[keyIdx]) : "#eee")
            .on("mouseover", (event, keyIdx) => {
                const details = d.beatDetails[keyIdx];
                if (!details || details.length === 0) return;
                tooltip.style("opacity", 1).html(`<strong>Details (${details.length}):</strong><br>${details.join('<br>')}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            })
            .on("mouseleave", () => { tooltip.style("opacity", 0); });
        panelGroup.append("g").attr("transform", `translate(${marginLeft}, 0)`).call(d3.axisLeft(yScale).ticks(3));
        panelGroup.append("text").attr("x", marginLeft - 8).attr("y", panelHeight / 2).attr("text-anchor", "end").style("font-size", "10px").text(d.id.replace("__", " vs "));
    });

    const bisect = d3.bisector(d => d.x).left;
    function findNearestIdx(mouseX) {
        if (!beatPositions || beatPositions.length === 0) return 0;
        const i = bisect(beatPositions, mouseX, 1);
        if (i <= 0) return beatPositions[0].idx;
        if (i >= beatPositions.length) return beatPositions[beatPositions.length - 1].idx;
        const d0 = mouseX - beatPositions[i - 1].x;
        const d1 = beatPositions[i].x - mouseX;
        return d0 < d1 ? beatPositions[i - 1].idx : beatPositions[i].idx;
    }

    let isSelection = false;
    axSvg.on("click", (event) => {
        isSelection = !isSelection;
        if (isSelection) setCurrentBeat(findNearestIdx(d3.pointer(event)[0]));
    }).on("mousemove", (event) => {
        if (isSelection) setCurrentBeat(findNearestIdx(d3.pointer(event)[0]));
    });

    return beatX;
}

/**
 * Aktualisiert die Position des Indikator-Strichs.
 */
export function updateAxisIndicator(idx, beatX) {
    if (indicator && beatX && typeof beatX[idx] !== 'undefined') {
        indicator.style("display", "block").attr("x1", beatX[idx]).attr("x2", beatX[idx]);
    } else if (indicator) {
        indicator.style("display", "none");
    }
}