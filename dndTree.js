// Get JSON data and handle it
d3.json("data.json", function(error, treeDataRaw) {
	// Handle treeDataRaw get error
	if (error) {
		throw error;
	}

	function getTreeDataRawNode(number) {
		for (var i = 0; i < treeDataRaw.length; ++i) {
			if (treeDataRaw[i].nodeNumber == number) {
				return treeDataRaw[i];
			}
		}
		throw new Error("Node not found");
	}

	// Get treeDataRaw subtree in usual format
	function getTreeDataRawSubtree(rootNumber) {
		var root = getTreeDataRawNode(rootNumber);
		var result = { "name": root.title };

		if (root.leftChild) {
			result.children = [
				getTreeDataRawSubtree(root.leftChild),
				getTreeDataRawSubtree(root.rightChild)
			];
		}

		return result;
	};

	// Misc. variables
	var assignedKeys = 0;
	var duration = 2500;

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

	// Define the zoom function for the zoomable tree
	function zoom() {
		svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
	}

	// define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
	var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);


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


	// Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.
	function centerNode(source) {
		scale = zoomListener.scale();
		x = -source.x0;
		y = -source.y0;
		x = x * scale + viewerWidth / 2;
		y = y * scale + viewerHeight / 2;
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
		return d;
	}

	// Toggle children on click.
	function click(d) {
		if (d3.event.defaultPrevented) return; // click suppressed
		d = toggleChildren(d);
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

		nodeEnter.append("circle")
			.attr('class', 'nodeCircle')
			.attr("r", 0);

		nodeEnter.append("text")
			.attr("y", -10)
			.attr("dy", ".35em")
			.attr('class', 'nodeText')
			.attr("text-anchor", "middle")
			.text(function(d) {
				return d.name;
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

		nodeUpdate.select("text")
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
				return "no info";
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

	// Define the root
	var root = getTreeDataRawSubtree(1);
	root.x0 = viewerWidth / 2;
	root.y0 = 0;

	// Layout the tree initially and center on the root node.
	update(root);
	centerNode(root);
});
