-- SPDX-License-Identifier: LGPL-2.1-or-later
space.palette = {
	{name = "space_core:alloy", title = "Pearl alloy", texture = "space_alloy.png"},
	{name = "space_core:slate", title = "Basalt", texture = "space_slate.png"},
	{name = "space_core:copper", title = "Copper rib", texture = "space_copper.png"},
	{name = "space_core:light", title = "Cyan signal", texture = "space_light.png"},
}
for _, material in ipairs(space.palette) do
	core.register_node(material.name, {
		description = material.title,
		tiles = {material.texture},
		paramtype2 = "4dir",
		groups = {space_material = 1},
		diggable = false, -- all edits go through the validated command service
		light_source = material.name == "space_core:light" and 8 or 0,
	})
end
core.register_node("space_core:anchor", {
	description = "Launch anchor",
	tiles = {"space_alloy.png"},
	diggable = false,
})
core.register_alias("mapgen_singlenode", "air")
