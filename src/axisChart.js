import * as d3 from 'd3';

let indicator;

export function initAxisChart(axSvg, axisLabelContainer, tooltip, linkData, allBeatKeys, beatInfo, globalMax, axisColor, nodeColor, setCurrentBeat) {
    axSvg.selectAll("*").remove();
    axisLabelContainer.selectAll("*").remove();

    if (!allBeatKeys || allBeatKeys.length === 0 || !linkData || linkData.length === 0) {
        axSvg.append("text").attr("x", 20).attr("y", 20).text("No Data.").attr("fill", "#999");
        return [];
    }

    const panelHeight = 25;
    const totalHeight = linkData.length * panelHeight;

    axisLabelContainer.style("height", `${totalHeight}px`);
    axisLabelContainer.selectAll("div").data(linkData).join("div")
        .attr("class", "axis-panel-label")
        .style("height", `${panelHeight}px`)
        .html(d => `
            <div class="color-swatch-container">
                <div class="color-swatch" style="background-color:${nodeColor(d.source)}"></div>
                <div class="color-swatch" style="background-color:${nodeColor(d.target)}"></div>
            </div>
            <span>${d.source} vs ${d.target}</span>
        `);

    const containerWidth = axSvg.node().parentElement.getBoundingClientRect().width;
    const marginLeft = 40;
    const minMeasureWidth = 100;
    const distinctMeasures = [...new Set(Object.values(beatInfo).map(info => info.measure))].sort((a,b)=>a-b);

    const axisWidth = Math.max(containerWidth, distinctMeasures.length * minMeasureWidth);
    axSvg.attr("width", axisWidth).attr("height", totalHeight);

    const innerWidth = axisWidth - marginLeft;
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

    indicator = axSvg.append("line").attr("stroke", "blue").attr("stroke-width", 1.5).attr("opacity", 0.7).style("pointer-events", "none").attr("y1", 0).attr("y2", totalHeight);

    linkData.forEach((d, i) => {
        const panelGroup = axSvg.append("g").attr("transform", `translate(0, ${i * panelHeight})`);
        const yScale = d3.scaleLinear().domain([0, globalMax]).range([panelHeight - 2, 2]);
        panelGroup.selectAll("rect").data(d3.range(allBeatKeys.length)).join("rect")
            .attr("x", keyIdx => beatX[keyIdx] ? beatX[keyIdx] - 2 : -10)
            .attr("y", keyIdx => yScale(d.beatCounts[keyIdx] || 0))
            .attr("width", 4).attr("height", keyIdx => (panelHeight - 2) - yScale(d.beatCounts[keyIdx] || 0))
            .attr("fill", keyIdx => (d.beatCounts[keyIdx] || 0) > 0 ? axisColor(d.beatCounts[keyIdx]) : "transparent")
            .on("mouseover", (event, keyIdx) => {
                const details = d.beatDetails[keyIdx];
                const info = beatInfo[allBeatKeys[keyIdx]];
                if (!info || (d.beatCounts[keyIdx] || 0) === 0) return;
                const tooltipContent = `<strong>${d.source} vs ${d.target}</strong><br>Takt: ${info.measure}, Beat: ${info.beat.toFixed(2)}<br>Differences: ${d.beatCounts[keyIdx]}<br><hr>${details ? details.join('<br>') : 'No Details'}`;
                tooltip.style("opacity", 1).html(tooltipContent);
            })
            .on("mousemove", (event) => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"))
            .on("mouseleave", () => tooltip.style("opacity", 0));
    });

    let isSelection = false;
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
    axSvg.on("click", (event) => {
        isSelection = !isSelection;
        if (isSelection) setCurrentBeat(findNearestIdx(d3.pointer(event)[0]));
    }).on("mousemove", (event) => {
        if (isSelection) setCurrentBeat(findNearestIdx(d3.pointer(event)[0]));
    });

    return beatX;
}

export function updateAxisIndicator(idx, beatX) {
    if (indicator && beatX && typeof beatX[idx] !== 'undefined') {
        indicator.style("display", "block").attr("x1", beatX[idx]).attr("x2", beatX[idx]);
    } else if (indicator) {
        indicator.style("display", "none");
    }
}