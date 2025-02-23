// Get URL of current page and also current node
var curr_url = decodeURI(window.location.href.replace(location.origin, ""));
if (curr_url.endsWith("/")) {
	curr_url = curr_url.slice(0, -1);
}

// Get list container
document.addEventListener("DOMContentLoaded", function () {
	var container = document.getElementById("list");
	if (!container) return;

	// Parse nodes
	var curr_node = [];
	try {
		curr_node = graph_data.nodes.filter((node) => decodeURI(node.url) == curr_url);
	} catch (error) {
		curr_node = [];
	}

	var nodes = [];
	if (curr_node.length > 0) {
		curr_node = curr_node[0];
		// Get connected nodes
		var connected_nodes = graph_data.edges
			.filter((edge) => edge.from == curr_node.id || edge.to == curr_node.id)
			.map((edge) => (edge.from == curr_node.id ? edge.to : edge.from));

		if (graph_is_local) {
			nodes = graph_data.nodes.filter((node) => node.id == curr_node.id || connected_nodes.includes(node.id));
		} else {
			nodes = graph_data.nodes;
		}
	} else {
		nodes = graph_data.nodes;
	}

	// Create list
	var ul = document.createElement("ul");
	ul.style.listStyleType = "none";
	ul.style.padding = "0";

	nodes.forEach((node) => {
		var li = document.createElement("li");
		var a = document.createElement("a");
		a.href = node.url;
		a.textContent = node.label;
		a.style.textDecoration = "none";
		a.style.color = "blue";
		li.appendChild(a);
		ul.appendChild(li);
	});

	container.appendChild(ul);
});
