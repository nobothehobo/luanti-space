-- SPDX-License-Identifier: LGPL-2.1-or-later
-- Small deterministic flight garden. Chunk generation never rewrites saved builds.
space.world = {}
local islands = {
	{x = 0, y = 30, z = 0, radius = 14, depth = 12},
	{x = 42, y = 52, z = 18, radius = 12, depth = 16},
	{x = -38, y = 65, z = 36, radius = 10, depth = 18},
	{x = 16, y = 92, z = -40, radius = 16, depth = 22},
	{x = -48, y = 18, z = -36, radius = 17, depth = 14},
}
function space.world.material_at(x, y, z)
	for index, island in ipairs(islands) do
		local depth = island.y - y
		if depth >= 0 and depth <= island.depth then
			local radius = island.radius * (1 - 0.75 * depth / island.depth)
			local dx, dz = x - island.x, z - island.z
			if dx * dx + dz * dz <= radius * radius then
				if index == 1 and depth == 0 and math.abs(x) <= 3 and math.abs(z) <= 3 then
					return "space_core:anchor"
				end
				if depth == 0 and (x + z) % 11 == 0 then return "space_core:light" end
				return depth == 0 and "space_core:alloy" or "space_core:slate"
			end
		end
	end
end
core.set_mapgen_setting("mg_name", "singlenode", true)
core.register_on_generated(function(minp, maxp)
	-- Reject nonintersecting chunks before allocating voxel buffers.
	if maxp.y < 4 or minp.y > 92 or maxp.x < -65 or minp.x > 54
		or maxp.z < -56 or minp.z > 46 then return end
	local vm, emin, emax = core.get_mapgen_object("voxelmanip")
	local area = VoxelArea:new({MinEdge = emin, MaxEdge = emax})
	local data = vm:get_data()
	local changed = false
	for z = math.max(minp.z, -56), math.min(maxp.z, 46) do
		for y = math.max(minp.y, 4), math.min(maxp.y, 92) do
			for x = math.max(minp.x, -65), math.min(maxp.x, 54) do
				local material = space.world.material_at(x, y, z)
				if material then
					data[area:index(x, y, z)] = core.get_content_id(material)
					changed = true
				end
			end
		end
	end
	if changed then
		vm:set_data(data)
		vm:calc_lighting()
		vm:write_to_map()
	end
end)
local storage = core.get_mod_storage()
local version = storage:get_int("space_schema")
assert(version <= space.version, "Luanti Space world was created by a newer game version")
if version == 0 then storage:set_int("space_schema", space.version) end
