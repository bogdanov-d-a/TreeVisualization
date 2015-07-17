(function() {

// Get JSON data and handle it
d3.json("data.json", function(error, data) {
	if (error) {
		throw error;
	}
	constructTree(convertTree(data, 1));
});

// Create tree on the page
function constructTree(root) {
	// Misc. variables
	var assignedKeys = 0;
	var duration = 750;

	// size of pass bar
	var passBarWidth = 25;
	var passBarHeight = 5;

	// size of the diagram
	var viewerWidth = $(document).width();
	var viewerHeight = $(document).height();

	// define a d3 diagonal projection for use by the node paths later on.
	diagonal = d3.svg.diagonal();

	// A recursive helper function for performing some setup by walking through all nodes
	function visit(parent, visitFn, childrenFn) {
		if (!parent) return;

		visitFn(parent);

		var children = childrenFn(parent);
		if (children) {
			var count = children.length;
			for (var i = 0; i < count; i++) {
				visit(children[i], visitFn, childrenFn);
			}
		}
	}

	// define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
	var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", function() {
		svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
	});


	// Helper functions for collapsing and expanding nodes.

	function collapse(d) {
		if (d.children) {
			d._children = d.children;
			d._children.forEach(collapse);
			d.children = null;
		}
	}

	function expand(d) {
		if (d._children) {
			d.children = d._children;
			d.children.forEach(expand);
			d._children = null;
		}
	}


	// Function to center node when clicked so node doesn't get lost when collapsing with large amount of children.
	function centerNode(node) {
		var scale = zoomListener.scale();
		var x = -node.x0 * scale + viewerWidth / 2;
		var y = -node.y0 * scale + viewerHeight / 2;
		d3.select('g').transition()
			.duration(duration)
			.attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
		zoomListener.scale(scale);
		zoomListener.translate([x, y]);
	}

	// Toggle children function
	function toggleChildren(d) {
		if (d.children) {
			d._children = d.children;
			d.children = null;
		} else if (d._children) {
			d.children = d._children;
			d._children = null;
		}
	}

	// Toggle children on click.
	function click(d) {
		if (d3.event.defaultPrevented) return; // click suppressed
		toggleChildren(d);
		update(d);
		centerNode(d);
	}

	function update(source) {
		// Call visit function to establish maxLabelLength
		var maxLabelLength = 0;
		visit(root, function(d) {
			maxLabelLength = Math.max(d.name.length, maxLabelLength);
		}, function(d) {
			return d.children && d.children.length > 0 ? d.children : null;
		});

		// Compute the new tree layout.
		var tree = d3.layout.tree()
			.nodeSize([maxLabelLength * 6, maxLabelLength * 4]);
		var nodes = tree.nodes(root),
			links = tree.links(nodes);

		// Update the nodes…
		var gNodes = svgGroup.selectAll("g.node")
			.data(nodes, function(d) {
				return d.id || (d.id = ++assignedKeys);
			});

		// Enter any new nodes at the parent's previous position.
		var nodeEnter = gNodes.enter().append("g")
			.attr("class", "node")
			.attr("transform", function(d) {
				return "translate(" + source.x0 + "," + source.y0 + ")";
			})
			.on('click', click);
		var leafNodeEnter = nodeEnter.filter(function(d, i) {
			return (!d.children && !d._children);
		});


		// Append circle and node title
		nodeEnter.append("circle")
			.attr('class', 'nodeCircle')
			.attr("r", 0);

		nodeEnter.append("text")
			.attr("y", -10)
			.attr('class', 'nodeText')
			.attr("text-anchor", "middle")
			.text(function(d) {
				return d.name;
			})
			.style("fill-opacity", 0);


		// Append pass info for leaf nodes
		leafNodeEnter.append("rect")
			.attr("x", -passBarWidth / 2)
			.attr("y", 20)
			.attr("width", function(d) { return passBarWidth * d.passTotalRatio; })
			.attr("height", passBarHeight)
			.style("fill", "green");

		leafNodeEnter.append("rect")
			.attr("x", function(d) { return -passBarWidth / 2 + passBarWidth * d.passTotalRatio; })
			.attr("y", 20)
			.attr("width", function(d) { return passBarWidth * (1 - d.passTotalRatio); })
			.attr("height", passBarHeight)
			.style("fill", "red");

		leafNodeEnter.append("text")
			.attr("y", 18)
			.attr("text-anchor", "middle")
			.text(function(d) {
				return d.passFailRatio;
			})
			.style("fill-opacity", 0);


		// Change the circle fill depending on whether it has children and is collapsed
		gNodes.select("circle.nodeCircle")
			.style("fill", function(d) {
				return d._children ? "lightsteelblue" : "#fff";
			});


		// Transition nodes to their new position.
		var nodeUpdate = gNodes.transition()
			.duration(duration)
			.attr("transform", function(d) {
				return "translate(" + d.x + "," + d.y + ")";
			});

		nodeUpdate.select("circle")
			.attr("r", 4.5);

		nodeUpdate.selectAll("text")
			.style("fill-opacity", 1);


		// Transition exiting nodes to the parent's new position.
		var nodeExit = gNodes.exit().transition()
			.duration(duration)
			.attr("transform", function(d) {
				return "translate(" + source.x + "," + source.y + ")";
			})
			.remove();

		nodeExit.select("circle")
			.attr("r", 0);

		nodeExit.select("text")
			.style("fill-opacity", 0);


		// Update the links…
		var gLinks = svgGroup.selectAll("g.link")
			.data(links, function(d) {
				return d.target.id;
			});


		// Enter any new links at the parent's previous position.
		var linkEnter = gLinks.enter().insert("g", "g")
			.attr("class", "link");

		linkEnter.append("path")
			.attr('class', 'linkPath')
			.attr("d", function(d) {
				var o = {
					x: source.x0,
					y: source.y0
				};
				return diagonal({
					source: o,
					target: o
				});
			});

		linkEnter.append("text")
			.attr('class', 'linkText')
			.attr("x", source.x0)
			.attr("y", source.y0)
			.attr("text-anchor", "middle")
			.text(function(d) {
				var sign;
				if (d.target.side == "left") {
					sign = ">";
				}
				else if (d.target.side == "right") {
					sign = "<=";
				}
				else {
					throw new Error("Child side is incorrect");
				}
				return sign + " " + d.source.passMark;
			})
			.style("fill-opacity", 0);


		// Transition links to their new position.
		var linkUpdate = gLinks.transition()
			.duration(duration);

		linkUpdate.select("path")
			.attr("d", diagonal);

		linkUpdate.select("text")
			.attr("x", function(d) { return (d.source.x + d.target.x) / 2; })
			.attr("y", function(d) { return (d.source.y + d.target.y) / 2; })
			.style("fill-opacity", 1);


		// Transition exiting links to the parent's new position.
		var linkExit = gLinks.exit().transition()
			.duration(duration)
			.remove();

		linkExit.select("path")
			.attr("d", function(d) {
				var o = {
					x: source.x,
					y: source.y
				};
				return diagonal({
					source: o,
					target: o
				});
			});

		linkExit.select("text")
			.attr("x", source.x)
			.attr("y", source.y)
			.style("fill-opacity", 0);


		// Stash the old positions for transition.
		nodes.forEach(function(d) {
			d.x0 = d.x;
			d.y0 = d.y;
		});
	}

	// Append a group which holds all nodes and which the zoom Listener can act upon.
	var svgGroup = d3.select("#tree-container").append("svg")
		.attr("width", viewerWidth)
		.attr("height", viewerHeight)
		.attr("class", "overlay")
		.call(zoomListener)
		.append("g");

	// Set start position
	root.x0 = viewerWidth / 2;
	root.y0 = 0;

	// Layout the tree initially and center on the root node.
	update(root);
	centerNode(root);
}

// Convert input data tree to more usable format
function convertTree(rawData, rootNumber) {
	return getSubtree(rootNumber, "root");

	function getSubtree(startNumber, startSide) {
		var start = getNode(startNumber);
		var result = {
			"name": start.title,
			"side": startSide
		};

		if (start.leftChild !== null) {
			result.passMark = start.passMark;
			result.children = [
				getSubtree(start.leftChild, "left"),
				getSubtree(start.rightChild, "right")
			];
		} else {
			result.passFailRatio = start.passed + " / " + start.failed;
			result.passTotalRatio = start.passed / (start.passed + start.failed);
		}

		return result;
	}

	function getNode(number) {
		for (var i = 0; i < rawData.length; ++i) {
			if (rawData[i].nodeNumber === number) {
				return rawData[i];
			}
		}
		throw new Error("Node not found");
	}
}

})();
