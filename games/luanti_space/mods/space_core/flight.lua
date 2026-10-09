-- SPDX-License-Identifier: LGPL-2.1-or-later
space.flight = {}
local function base(name, fallback)
	local value = tonumber(core.settings:get(name))
	return space.finite(value) and value > 0 and value or fallback
end
function space.flight.apply(player)
	local meta = player:get_meta()
	local assist = meta:get_string("space_assist")
	if assist ~= "gentle" then assist = "precise" end
	-- Match native acceleration-setting units, not speed units: LocalPlayer
	-- applies an additional BS factor. 3.5 yields about 35 nodes/s^2.
	local acceleration = assist == "precise" and 3.5 or 1.8
	player:set_physics_override({
		speed = 1,
		speed_walk = space.config.cruise_speed / base("movement_speed_walk", 4),
		speed_fast = space.config.boost_speed / base("movement_speed_fast", 20),
		acceleration_default = acceleration / base("movement_acceleration_default", 3),
		acceleration_fast = 5 / base("movement_acceleration_fast", 10),
		gravity = 0,
	})
end
core.register_on_joinplayer(function(player)
	local meta = player:get_meta()
	local version = meta:get_int("space_schema")
	if version > space.version then
		core.kick_player(player:get_player_name(), "Player save requires a newer Luanti Space version")
		return
	end
	space.flight.apply(player)
	player:set_armor_groups({immortal = 1})
	player:set_properties({textures = {"space_pilot.png", "space_pilot_back.png"},
		makes_footstep_sound = false, zoom_fov = 0}) -- R is the architect rotation binding
	if version == 0 then
		player:set_pos(space.config.spawn)
		meta:set_int("space_schema", space.version)
	end
	-- Luanti persists subsequent position, inventory and metadata in its player DB.
end)
core.register_on_respawnplayer(function(player)
	player:set_pos(space.config.spawn)
	return true
end)
