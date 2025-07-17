const fileInput = document.getElementById("diffFiles"),
    loadBtn = document.getElementById("loadBtn"),
    exampleBtn = document.getElementById("example")
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

    // During parsing, we store only those beats that actually appear:
    diffByBeat = {},      // keyed by "M-B"
    beatInfo = {},      // maps "M-B" → { measure: M, beat: B }
    edges = [],
    nodesMap = {};

const PRESET_DIFFS = [
    "1803_BdA_ED_Op33_1.mei_1808_Zulehner_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1825_Andre_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1826_Schott_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1803_BdA_ED_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1825_Andre_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1826_Schott_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1808_Zulehner_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1825_Andre_Op33_1.mei_1826_Schott_Op33_1.mei.txt",
    "1825_Andre_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1825_Andre_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1826_Schott_Op33_1.mei_1845_Haslinger_Op33_1.mei.txt",
    "1826_Schott_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt",
    "1845_Haslinger_Op33_1.mei_1864_Breitkopf_Haertel_Op33_1.mei.txt"
]


function parseDiff(text, filename) {
    console.log("parseDiff")
    const lines = text.split("\n");
    // First two lines: extract only the file ID from each path
    const a = lines[0].replace(/--- (\/.*)\//, ""),
        b = lines[1].replace(/\+\+\+ (\/.*)\//, "");
    if (!nodesMap[a]) nodesMap[a] = {id: a};
    if (!nodesMap[b]) nodesMap[b] = {id: b};

    const edge = {source: a, target: b, beatCounts: {}, beatDetails: {}};
    let curKeyStr = null;

    lines.forEach(line => {
        if (line.startsWith("@@")) {
            // Extract “measure X, beat Y” from the diff‐hunk header
            const m = /measure\s+(\d+),.*beat\s+([\d.]+)/.exec(line);
            if (m) {
                const M = parseInt(m[1], 10),
                    B = parseFloat(m[2]),
                    keyStr = `${M}-${B}`;
                curKeyStr = keyStr;
                if (!beatInfo[keyStr]) {
                    beatInfo[keyStr] = {measure: M, beat: B};
                    diffByBeat[keyStr] = 0;
                }
            }
        } else if (
            curKeyStr !== null &&
            (line.startsWith("+") || line.startsWith("-"))
        ) {
            // Count this diff‐line under the current (M-B) key
            edge.beatCounts[curKeyStr] = (edge.beatCounts[curKeyStr] || 0) + 1;
            diffByBeat[curKeyStr] = (diffByBeat[curKeyStr] || 0) + 1;
            if (!edge.beatDetails[curKeyStr]) edge.beatDetails[curKeyStr] = [];
            edge.beatDetails[curKeyStr].push(line);
        }
    });

    edges.push(edge);
}
const start = () => {
    const files = fileInput.files;
    console.log(files);
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
}

loadBtn.onclick = () => {
    start();
};


exampleBtn.onclick = () => {
    const diffPromises = PRESET_DIFFS.map((diffName) =>

        fetch(`example/diffs/${diffName}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to fetch diff ${diffName}`);

                return res.text();
            })
            .then((text) => {
                console.log(text.length, diffName)
                parseDiff(text, diffName);
            }));

    Promise.all(diffPromises)
        .then(() => {
            initVis();
        })
        .catch((err) => {
            console.error("Error loading diffs:", err);
        });

}

function initVis() {
    //
    // ─── 1) FILL MISSING “M-B” BEATS WITH ZERO ENTRIES ───────────────────
    //
    // Group observed beats by measure
    let beatsByMeasure = {};
    Object.entries(beatInfo).forEach(([keyStr, info]) => {
        const M = info.measure, B = info.beat;
        if (!beatsByMeasure[M]) beatsByMeasure[M] = new Set();
        beatsByMeasure[M].add(B);
    });

    // For each measure, find smallest step between beats, then fill in gaps:
    Object.entries(beatsByMeasure).forEach(([mStr, beatSet]) => {
        const M = parseInt(mStr, 10);
        let beatsArr = Array.from(beatSet).sort((a, b) => a - b);

        // Determine minimum positive difference → "step"
        let step = 1.0;
        if (beatsArr.length > 1) {
            const diffs = [];
            for (let i = 1; i < beatsArr.length; i++) {
                diffs.push(beatsArr[i] - beatsArr[i - 1]);
            }
            step = Math.min(...diffs);
        }

        const minB = beatsArr[0],
            maxB = beatsArr[beatsArr.length - 1],
            nSteps = Math.round((maxB - minB) / step);

        for (let i = 0; i <= nSteps; i++) {
            // Avoid floating‐point drift:
            const Bcur = +((minB + i * step).toFixed(6));
            const keyStr = `${M}-${Bcur}`;
            if (!beatInfo[keyStr]) {
                // Insert zero‐filled entry if it didn't exist
                beatInfo[keyStr] = {measure: M, beat: Bcur};
                diffByBeat[keyStr] = 0;
                edges.forEach(e => {
                    e.beatCounts[keyStr] = 0;
                    e.beatDetails[keyStr] = [];
                });
            }
        }
    });

    //
    // ─── 2) REBUILD beatsByMeasure NOW THAT WE’VE ZERO‐FILLED ───────────────────
    //
    beatsByMeasure = {};
    Object.entries(beatInfo).forEach(([keyStr, info]) => {
        const M = info.measure, B = info.beat;
        if (!beatsByMeasure[M]) beatsByMeasure[M] = new Set();
        beatsByMeasure[M].add(B);
    });

    // Sort measure numbers ascending:
    const distinctMeasures = Object.keys(beatsByMeasure)
        .map(Number)
        .sort((a, b) => a - b);

    // For each measure, collect a sorted array of its beats:
    const measureBeats = {};
    distinctMeasures.forEach(M => {
        measureBeats[M] = Array.from(beatsByMeasure[M]).sort((a, b) => a - b);
    });

    //
    // ─── 3) BUILD A SORTED LIST OF ALL "M-B" KEYS AND ASSIGN INTEGER INDICES ───────────────────
    //
    const allBeatKeys = Object.keys(beatInfo).slice();
    allBeatKeys.sort((a, b) => {
        const [mA, bA] = a.split("-").map(Number);
        const [mB, bB] = b.split("-").map(Number);
        if (mA !== mB) return mA - mB;
        return bA - bB;
    });

    const beatIndex = {};
    allBeatKeys.forEach((keyStr, i) => {
        beatIndex[keyStr] = i;
    });

    // Re‐map each edge’s beatCounts/beatDetails → integer keys
    const linkData = edges.map(e => {
        const newCounts = {},
            newDetails = {};
        Object.entries(e.beatCounts).forEach(([keyStr, count]) => {
            const idx = beatIndex[keyStr];
            newCounts[idx] = count;
            newDetails[idx] = e.beatDetails[keyStr] || [];
        });
        return {
            id: `${e.source}__${e.target}`,
            source: e.source,
            target: e.target,
            beatCounts: newCounts,
            beatDetails: newDetails
        };
    });

    //
    // ─── 4) COMPUTE A SINGLE GLOBAL MAXIMUM DIFF COUNT ───────────────────
    //
    const globalMax = d3.max(
        linkData.map(d =>
            d3.max(
                Object.values(d.beatCounts).length
                    ? Object.values(d.beatCounts)
                    : [0]
            )
        )
    ) || 0;

    function computeSimilarity(d, idx) {
        const count = d.beatCounts[idx] || 0;
        if (globalMax === 0) return 1;
        return 1 - (count / globalMax);  // inverted → 1 = perfect match
    }



    //
    // ─── 5) SET UP “MEASURE‐BASED” X‐POSITIONING ───────────────────
    //
    const marginLeft = 40,
        marginRight = 40,
        innerWidth = width - marginLeft - marginRight,
        numMeasures = distinctMeasures.length,
        measureWidth = innerWidth / numMeasures;

    // Precompute a lookup from (beatIdx → absolute X‐coordinate)
    const beatX = new Array(allBeatKeys.length);
    allBeatKeys.forEach((keyStr, idx) => {
        const info = beatInfo[keyStr],
            M = info.measure,
            B = info.beat;
        // Which measure‐index is this?
        const measureIndex = distinctMeasures.indexOf(M);
        // Among that measure, which position is this beat?
        const beatsArr = measureBeats[M],
            beatIdxInMeasure = beatsArr.indexOf(B),
            numBeats = beatsArr.length;
        // Center‐the beat slot inside [measureIndex*measureWidth .. (measureIndex+1)*measureWidth]
        const xPos = marginLeft
            + measureIndex * measureWidth
            + (beatIdxInMeasure + 0.5) * (measureWidth / numBeats);
        beatX[idx] = xPos;
    });

    // Build a sorted array of just the X‐values, for bisecting:
    const beatXs = beatX.slice(); // already in ascending order because allBeatKeys was sorted by (M,B)

    // A small helper to find the nearest beat‐index for any given mouseX:
    const bisect = d3.bisector(d => d).left;

    function findNearestIdx(mouseX) {
        let i = bisect(beatXs, mouseX);
        if (i === 0) return 0;
        if (i >= beatXs.length) return beatXs.length - 1;
        // Compare neighbor to see which is closer
        return (Math.abs(mouseX - beatXs[i - 1]) < Math.abs(mouseX - beatXs[i]))
            ? (i - 1)
            : i;
    }

    //
    // ─── 6) DRAW NETWORK + LEGEND ───────────────────
    //
    const nodes = Object.values(nodesMap);
    const color = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(linkData.map(d => d.id));

    const legend = netSvg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 320}, 20)`);

    legend.selectAll("g.entry")
        .data(linkData)
        .enter()
        .append("g")
        .attr("class", "entry")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`)
        .each(function (d) {
            d3.select(this)
                .append("rect")
                .attr("x", 0)
                .attr("y", -10)
                .attr("width", 12)
                .attr("height", 12)
                .attr("fill", color(d.id));
            d3.select(this)
                .append("text")
                .attr("x", 18)
                .attr("y", 0)
                .text(`${d.source} ↔ ${d.target}`);
        });

    //
    // ─── 7) DRAW BAR PANELS (ONE PER EDGE) ───────────────────
    //
    const minKey = 0,
        maxKey = allBeatKeys.length - 1,
        nEdges = linkData.length,
        panelHeight = axHeight / nEdges,
        barWidth = 4;

    linkData.forEach((d, i) => {
        const yScale = d3.scaleLinear()
            .domain([0, globalMax || 1])
            .range([panelHeight, 0]);

        const panelGroup = axSvg.append("g")
            .attr("transform", `translate(0, ${i * panelHeight})`);

        // (a) Draw baseline across all measures
        panelGroup.append("line")
            .attr("x1", marginLeft)
            .attr("y1", panelHeight)
            .attr("x2", marginLeft + innerWidth)
            .attr("y2", panelHeight)
            .attr("stroke", "#000");

        // (b) Draw a grey line at every measure‐start:
        //     These are at x = marginLeft + measureIndex*measureWidth for each measureIndex.
        const measureStarts = distinctMeasures.map((_, mi) => marginLeft + mi * measureWidth);
        panelGroup.selectAll("line.measureStart")
            .data(measureStarts)
            .enter()
            .append("line")
            .attr("class", "measureStart")
            .attr("x1", d => d)
            .attr("y1", 0)
            .attr("x2", d => d)
            .attr("y2", panelHeight)
            .attr("stroke", "lightgrey")
            .attr("stroke-width", 1);

        // (c) Draw every beat's bar (zero‐height if count=0), centered at the beat's X
        for (let keyIdx = minKey; keyIdx <= maxKey; keyIdx++) {
            const c = d.beatCounts[keyIdx] || 0;
            const xCenter = beatX[keyIdx],
                rectX = xCenter - barWidth / 2,
                y = yScale(c),
                h = panelHeight - y;
            panelGroup.append("rect")
                .attr("x", rectX)
                .attr("y", y)
                .attr("width", barWidth)
                .attr("height", h)
                .attr("fill", color(d.id));
        }

        // (d) Draw left‐axis with identical ticks for every panel
        const yAxis = d3.axisLeft(yScale).ticks(3);
        panelGroup.append("g")
            .attr("transform", `translate(${marginLeft}, 0)`)
            .call(yAxis);

        // (e) (optional) label for each panel on its left
        /*panelGroup.append("text")
            .attr("x", marginLeft - 5)
            .attr("y", panelHeight / 2)
            .attr("text-anchor", "end")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "12px")
            .text(`${d.source} ↔ ${d.target}`);*/
    });

    //
    // ─── 8) DRAW A SINGLE VERTICAL “CURRENT BEAT” LINE ───────────────────
    //
    const indicator = axSvg.append("line")
        .attr("x1", beatX[minKey])
        .attr("x2", beatX[minKey])
        .attr("y1", 0)
        .attr("y2", axHeight)
        .attr("stroke", "blue")
        .attr("opacity", "0.5")
        .attr("stroke-width", 2);

    let isSelection = false;
    axSvg.on("click", () => {
        isSelection = !isSelection;
    });
    axSvg.on("mousemove", (event) => {
        if (!isSelection) return;
        const [mx] = d3.pointer(event);
        const nearestIdx = findNearestIdx(mx);
        setCurrentBeat(nearestIdx);
    });

    //
    // ─── 9) FORCE‐DIRECTED NETWORK LAYOUT ───────────────────
    //
    const weightToggle = document.getElementById("weightToggle");

// (put this at the top of initVis if you want the toggle switch globally available)

    const linkForce = d3.forceLink(linkData)
        .id(d => d.id)
        .distance(d => {
            if (!weightToggle.checked) return 150;
            const sim = computeSimilarity(d, +beatSlider.value);
            const minDist = 100, maxDist = 250;
            return maxDist - sim * (maxDist - minDist); // similarity → shorter distance
        })
        .strength(d => {
            if (!weightToggle.checked) return 1;
            return computeSimilarity(d, +beatSlider.value); // similarity → stronger pull
        });



    const simulation = d3.forceSimulation(nodes)
        .force("link", linkForce)
        .force("charge", d3.forceManyBody().strength(-2000))
        .force("center", d3.forceCenter(width / 2, height / 2));



    const linkGroups = linkG.selectAll("g.linkGroup")
        .data(linkData)
        .enter()
        .append("g")
        .attr("class", "linkGroup");

    // (a) Invisible hit‐area for easier hover
    linkGroups.append("line")
        .attr("class", "hitarea")
        .attr("stroke", "transparent")
        .attr("stroke-width", 10);

    // (b) Visible colored link
    linkGroups.append("line")
        .attr("class", "linkLine")
        .attr("stroke", d => color(d.id))
        .attr("stroke-width", 1);

    // (c) Hover to show diffs at the current beat
    linkGroups.on("mouseover", (event, d) => {
        const currIdx = +beatSlider.value;
        const keyStr = allBeatKeys[currIdx];
        const info = beatInfo[keyStr];
        const diffs = d.beatDetails[currIdx] || [];
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
        .on("mousemove", (event) => {
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
                const currIdx = +beatSlider.value;
                const sim = computeSimilarity(d, currIdx);
                return Math.max(1, 1 + 3 * sim);
            });


        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);
        label.attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    //
    // ─── 10) SLIDER SETUP ───────────────────
    //
    beatSlider.min = minKey;
    beatSlider.max = maxKey;
    beatSlider.step = 1;
    beatSlider.value = minKey;
    beatSlider.disabled = false;
    beatSlider.oninput = () => {
        const v = +beatSlider.value;
        setCurrentBeat(v);
    };

    setCurrentBeat(minKey);


    function setCurrentBeat(idx) {
        beatSlider.value = idx;
        const keyStr = allBeatKeys[idx];
        const info = beatInfo[keyStr];
        beatLabel.textContent = `Measure: ${info.measure}, Beat: ${info.beat.toFixed(2)}`;
        indicator
            .attr("x1", beatX[idx])
            .attr("x2", beatX[idx]);

        // update link strength and distance
        linkForce
            .strength(d => {
                if (!weightToggle.checked) return 1;
                return computeSimilarity(d, idx);
            })
            .distance(d => {
                if (!weightToggle.checked) return 150;
                const sim = computeSimilarity(d, idx);
                const minDist = 60, maxDist = 300;
                return maxDist - sim * (maxDist - minDist);
            });

        // update thickness of links
        linkGroups.selectAll(".linkLine")
            .attr("stroke-width", d => {
                const sim = computeSimilarity(d, idx);
                return 1 + 3 * sim;  // similar = thicker
            });

        simulation.alpha(0.3).restart();
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
    weightToggle.onchange = () => {
        setCurrentBeat(+beatSlider.value);
    };
}
