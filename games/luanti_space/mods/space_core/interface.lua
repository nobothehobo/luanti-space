-- SPDX-License-Identifier: LGPL-2.1-or-later
space.interface = {}
local interface = space.interface
core.register_privilege("space_build", {
	description = "Use Luanti Space construction tools", give_to_singleplayer = true,
})
local function command(player, action)
	local ok, message = space.building.dispatch(player, action)
	core.chat_send_player(player:get_player_name(), message)
	return ok
end
function interface.show(player)
	local session = space.building.session(player)
	if not session then return end
	local form = "formspec_version[6]size[8,7]" ..
		"bgcolor[#101c2df5;true]" ..
		"style_type[button;bgcolor=#29455c;textcolor=#e3f7ff;border=false]" ..
		"label[0.45,0.45;LUANTI SPACE / ARCHITECT]" ..
		"label[0.45,1.05;Material: " .. space.palette[session.material].title .. "]"
	for index, material in ipairs(space.palette) do
		local x = 0.45 + (index - 1) * 1.9
		form = form .. "item_image_button[" .. x .. ",1.5;1.75,1.3;" .. material.name
			.. ";material_" .. index .. ";]tooltip[material_" .. index .. ";" .. material.title .. "]"
	end
	form = form .. "button[0.45,3;2.15,0.8;rotate;Rotate: " .. session.rotation * 90 .. " deg]"
		.. "button[2.9,3;2.15,0.8;undo;Undo (" .. #session.undo .. ")]"
		.. "button[5.35,3;2.15,0.8;redo;Redo (" .. #session.redo .. ")]"
		.. "label[0.45,4.25;Flight assist / acceleration and braking]"
		.. "button[0.45,4.65;3.35,0.8;precise;Precise]button[4.15,4.65;3.35,0.8;gentle;Gentle]"
		.. "button_exit[0.45,5.85;7.05,0.8;quit;Return to flight]"
	core.show_formspec(player:get_player_name(), "space_core:architect", form)
end
core.register_on_player_receive_fields(function(player, formname, fields)
	if formname ~= "space_core:architect" then return end
	local session = space.building.session(player)
	if not session then return true end
	-- One whitelisted action per form event. No arbitrary node names or positions.
	for index in ipairs(space.palette) do
		if fields["material_" .. index] then
			session.material = index
			player:get_meta():set_int("space_material", index)
			interface.show(player)
			return true
		end
	end
	for _, action in ipairs({"rotate", "undo", "redo"}) do
		if fields[action] then
			command(player, action)
			interface.show(player)
			return true
		end
	end
	for _, assist in ipairs({"precise", "gentle"}) do
		if fields[assist] then
			player:get_meta():set_string("space_assist", assist)
			space.flight.apply(player)
			interface.show(player)
			return true
		end
	end
	return true
end)
core.register_chatcommand("space", {
	params = "[rotate|undo|redo|home]",
	description = "Open the architect palette or run a construction action",
	func = function(name, parameter)
		local player = core.get_player_by_name(name)
		if not player then return false, "Join the world first" end
		if parameter == "" then interface.show(player); return true end
		if parameter == "home" then player:set_pos(space.config.spawn); return true, "Returned to launch anchor" end
		return space.building.dispatch(player, parameter)
	end,
})
local huds = {}
core.register_on_joinplayer(function(player)
	player:hud_set_flags({healthbar = false, breathbar = false, crosshair = true})
	player:set_inventory_formspec("formspec_version[6]size[6,3]bgcolor[#101c2df5;true]"
		.. "label[0.5,0.55;Luanti Space / Flight garden]"
		.. "button[0.5,1.3;5,0.9;architect;Open architect palette]")
	player:set_sky({type = "regular", clouds = true, sky_color = {
		day_sky = "#477a9b", day_horizon = "#b6d2d3", indoors = "#1e3042",
	}})
	player:set_clouds({height = 112, density = 0.3, color = "#d4ebece8"})
	player:override_day_night_ratio(0.85)
	huds[player:get_player_name()] = player:hud_add({
		type = "text", position = {x = 0.02, y = 0.035}, alignment = {x = 1, y = 1},
		number = 0xcdeaf0, text = "LUANTI SPACE  /  FLIGHT GARDEN", scale = {x = 100, y = 20},
	})
	core.chat_send_player(player:get_player_name(),
		"Luanti Space: fly with Jump/Sneak; boost with Aux1. Place/Remove with architect tool. "
		.. "Open Inventory for palette. If flight is off, enable Fly and Fast in Controls.")
end)
core.register_on_player_receive_fields(function(player, formname, fields)
	if formname == "" and fields.architect then interface.show(player) end
end)
core.register_on_leaveplayer(function(player) huds[player:get_player_name()] = nil end)
local timer = 0
core.register_globalstep(function(dtime)
	timer = timer + dtime
	if timer < 0.25 then return end
	timer = 0
	for _, player in ipairs(core.get_connected_players()) do
		local session = space.building.session(player)
		local id = huds[player:get_player_name()]
		if session and id then
			local action = space.actions.from_control(player:get_player_control())
			local velocity = player:get_velocity()
			local speed = math.sqrt(velocity.x ^ 2 + velocity.y ^ 2 + velocity.z ^ 2)
			local text = "LUANTI SPACE  /  " .. (action.boost and "BOOST" or "ASSISTED FLIGHT")
				.. string.format("  %.1f m/s", speed) .. "\n"
				.. space.palette[session.material].title .. "  /  " .. session.rotation * 90
				.. " deg  /  Inventory: palette"
			if text ~= session.hud_text then
				player:hud_change(id, "text", text)
				session.hud_text = text
			end
		end
	end
end)
