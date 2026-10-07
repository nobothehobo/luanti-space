-- SPDX-License-Identifier: LGPL-2.1-or-later
space.config = {
	reach = 10,
	edit_interval = 0.16,
	preview_interval = 0.1,
	history_limit = 64,
	world_limit = 30000,
	cruise_speed = 7,
	boost_speed = 18,
	spawn = {x = 0, y = 34, z = 0},
}
function space.finite(value)
	return type(value) == "number" and value == value and math.abs(value) < math.huge
end
function space.valid_cell(pos)
	if type(pos) ~= "table" then return false end
	for _, axis in ipairs({"x", "y", "z"}) do
		local value = pos[axis]
		if not space.finite(value) or value ~= math.floor(value)
			or math.abs(value) > space.config.world_limit then
			return false
		end
	end
	return true
end
