const fileInput = document.getElementById("diffFiles"),
    loadBtn = document.getElementById("loadBtn"),
    beatSlider = document.getElementById("beatSlider"),
    beatLabel = document.getElementById("beatLabel"),
    netSvg = d3.select("#network"),
    axSvg = d3.select("#axis"),
    tooltip = d3.select("#tooltip"),
    width = +netSvg.attr("width"),
    height = +netSvg.attr("height"),
    axHeight = +axSvg.attr("height"),
    netG = netSvg.append("g"),
    linkG = netG.append("g"),
    nodeG = netG.append("g"),
    diffByBeat = {},
    beatInfo = {},          // Maps numeric key → {measure, beat}
    edges = [],
    nodesMap = {};

function parseDiff(text, filename) {
    const parts = filename.replace(/_diff\.txt$/, "").split("__"),
        a = parts[0], b = parts[1];
    if (!nodesMap[a]) nodesMap[a] = { id: a };
    if (!nodesMap[b]) nodesMap[b] = { id: b };
    const edge = { source: a, target: b, beatCounts: {}, beatDetails: {} };
    let curKey = null;
    text.split("\n").forEach(line => {
        if (line.startsWith("@@")) {
            const m = /measure\s+(\d+),.*beat\s+([\d.]+)/.exec(line);
            if (m) {
                const M = parseInt(m[1], 10),
                    B = parseFloat(m[2]);
                // Zero-indexed numeric key for scale: (M - 1) + (B - 1)
                curKey = (M - 1) + (B - 1);
                // Store original measure and beat for tooltips
                if (!beatInfo[curKey]) beatInfo[curKey] = { measure: M, beat: B };
            }
        } else if (curKey !== null && (line.startsWith("+") || line.startsWith("-"))) {
            edge.beatCounts[curKey] = (edge.beatCounts[curKey] || 0) + 1;
            diffByBeat[curKey] = (diffByBeat[curKey] || 0) + 1;
            if (!edge.beatDetails[curKey]) edge.beatDetails[curKey] = [];
            edge.beatDetails[curKey].push(line);
        }
    });
    edges.push(edge);
}

loadBtn.onclick = () => {
    const files = fileInput.files;
    if (!files.length) return;
    let loaded = 0;
    for (let f of files) {
        const reader = new FileReader();
        reader.onload = () => {
            parseDiff(reader.result, f.name);
            if (++loaded === files.length) initVis();
        };
        reader.readAsText(f);
    }
};

function initVis() {
    const nodes = Object.values(nodesMap),
        linkData = edges.map(e => Object.assign({}, e));
    // All numeric keys:
    const beats = Object.keys(diffByBeat).map(Number).sort((a, b) => a - b),
        minKey = beats[0] || 0,
        maxKey = beats[beats.length - 1] || 1;

    const xScale = d3.scaleLinear()
            .domain([minKey, maxKey])
            .range([40, width - 40]),
        maxDiff = d3.max(Object.values(diffByBeat)),
        barH = d3.scaleLinear()
            .domain([0, maxDiff || 1])
            .range([0, axHeight / 2 - 10]);

    // Draw horizontal axis line
    axSvg.append("line")
        .attr("x1", xScale(minKey)).attr("y1", axHeight/2)
        .attr("x2", xScale(maxKey)).attr("y2", axHeight/2)
        .attr("stroke", "#000");

    // Draw vertical diff markers (always upward)
    axSvg.selectAll("line.diff")
        .data(beats)
        .enter()
        .append("line")
        .attr("class", "diff")
        .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
        .attr("y1", axHeight/2)
        .attr("y2", d => axHeight/2 - barH(diffByBeat[d]))
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .on("mouseover", (event, key) => {
            const info = beatInfo[key];
            const total = diffByBeat[key];
            let content = `Measure ${info.measure}, Beat ${info.beat.toFixed(2)}: total diffs = ${total}\n`;
            edges.forEach(e => {
                const c = e.beatCounts[key] || 0;
                if (c > 0) {
                    content += `${e.source} ↔ ${e.target}: ${c}\n`;
                }
            });
            tooltip.html(content)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px")
                .style("display", "block");
        })
        .on("mousemove", event => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });

    // Current-beat indicator
    const indicator = axSvg.append("line")
        .attr("x1", xScale(minKey)).attr("x2", xScale(minKey))
        .attr("y1", axHeight/2 - 10).attr("y2", axHeight/2 + 10)
        .attr("stroke", "blue").attr("stroke-width", 3);

    // Axis hover: set current beat on mousemove (snapped)
    axSvg.on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        let val = xScale.invert(mx);
        // Snap to nearest actual key
        const nearest = beats.reduce((a, c) => Math.abs(c - val) < Math.abs(a - val) ? c : a, beats[0]);
        setCurrentBeat(nearest);
    });

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(linkData).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width/2, height/2));

    // Draw edges with hit areas
    const linkGroups = linkG.selectAll("g.linkGroup")
        .data(linkData)
        .enter()
        .append("g")
        .attr("class", "linkGroup");

    // Invisible wide lines for easier hover
    linkGroups.append("line")
        .attr("class", "hitarea")
        .attr("stroke", "transparent")
        .attr("stroke-width", 10);

    // Visible lines on top
    linkGroups.append("line")
        .attr("class", "linkLine")
        .attr("stroke", "#999")
        .attr("stroke-width", 1);

    // Hover events on hitarea
    linkGroups.on("mouseover", (event, d) => {
        const curr = +beatSlider.value;
        // Snap to nearest key
        const nearest = beats.reduce((a, c) => Math.abs(c - curr) < Math.abs(a - curr) ? c : a, beats[0]);
        const info = beatInfo[nearest];
        const diffs = d.beatDetails[nearest] || [];
        let content = `Edge ${d.source} ↔ ${d.target}\n`;
        content += `Measure ${info.measure}, Beat ${info.beat.toFixed(2)} diffs:\n`;
        if (diffs.length) {
            diffs.forEach(line => {
                content += line + "\n";
            });
        } else {
            content += "(no diffs at this beat)\n";
        }
        tooltip.html(content)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px")
            .style("display", "block");
    })
        .on("mousemove", event => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });

    const node = nodeG.selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", 8)
        .attr("fill", "orange")
        .call(drag(simulation));

    const label = nodeG.selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .text(d => d.id)
        .attr("font-size", 12)
        .attr("dx", 12)
        .attr("dy", 4);

    simulation.on("tick", () => {
        linkGroups.selectAll(".hitarea")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        linkGroups.selectAll(".linkLine")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y)
            .attr("stroke-width", d => {
                const curr = +beatSlider.value;
                const nearest = beats.reduce((a, c) => Math.abs(c - curr) < Math.abs(a - curr) ? c : a, beats[0]);
                return d.beatCounts[nearest] || 0;
            });
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    // Slider setup
    beatSlider.min = minKey;
    beatSlider.max = maxKey;
    beatSlider.step = 0.01;
    beatSlider.value = minKey;
    beatSlider.disabled = false;
    beatSlider.oninput = () => {
        const v = +beatSlider.value;
        const nearest = beats.reduce((a, c) => Math.abs(c - v) < Math.abs(a - v) ? c : a, beats[0]);
        setCurrentBeat(nearest);
    };

    // Initial display
    setCurrentBeat(minKey);

    function setCurrentBeat(key) {
        beatSlider.value = key;
        const info = beatInfo[key];
        beatLabel.textContent = `Measure: ${info.measure}, Beat: ${info.beat.toFixed(2)}`;
        indicator.attr("x1", xScale(key)).attr("x2", xScale(key));
        // Trigger one tick’s link redraw
        simulation.alpha(0.1).restart();
    }

    function drag(sim) {
        return d3.drag()
            .on("start", event => {
                if (!event.active) sim.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            })
            .on("drag", event => {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            })
            .on("end", event => {
                if (!event.active) sim.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            });
    }
}