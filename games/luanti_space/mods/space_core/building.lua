-- SPDX-License-Identifier: LGPL-2.1-or-later
-- All entry points (tool, menu, repeat) call one server-owned edit service.
space.building = {sessions = {}}
local building = space.building
local revisions = {}
local serial = 0
local function key(pos) return pos.x .. ":" .. pos.y .. ":" .. pos.z end
local function same(a, b)
	return a and b and a.name == b.name and a.param2 == b.param2
end
local function copy_node(node) return {name = node.name, param2 = node.param2 or 0} end
local function record_revision(pos)
	serial = serial + 1
	revisions[key(pos)] = serial
	return serial
end
function building.session(player)
	return building.sessions[player:get_player_name()]
end
function building.eye(player)
	return vector.add(player:get_pos(), {x = 0, y = player:get_properties().eye_height, z = 0})
end
function building.target(player)
	local eye = building.eye(player)
	local direction = player:get_look_dir()
	for _, axis in ipairs({"x", "y", "z"}) do
		if not space.finite(eye[axis]) or not space.finite(direction[axis]) then return end
	end
	local endpoint = vector.add(eye, vector.multiply(direction, space.config.reach))
	for hit in core.raycast(eye, endpoint, false, false) do
		if hit.type == "node" then return hit end
	end
end
local function authorized(player)
	return player and player:is_player()
		and core.check_player_privs(player, {interact = true, space_build = true})
end
local function overlaps_player(pos)
	for _, player in ipairs(core.get_connected_players()) do
		local location = player:get_pos()
		local box = player:get_properties().collisionbox
		if box and location.x + box[1] < pos.x + 0.5 and location.x + box[4] > pos.x - 0.5
			and location.y + box[2] < pos.y + 0.5 and location.y + box[5] > pos.y - 0.5
			and location.z + box[3] < pos.z + 0.5 and location.z + box[6] > pos.z - 0.5 then
			return true
		end
	end
	return false
end
function building.validate(player, pos, placing)
	if not authorized(player) then return false, "Building permission required" end
	if not space.valid_cell(pos) then return false, "Invalid grid cell" end
	-- Allow half a voxel for the distance from intersected face to node center.
	if vector.distance(building.eye(player), pos) > space.config.reach + 0.9 then
		return false, "Outside build reach"
	end
	if core.is_protected(pos, player:get_player_name()) then return false, "Protected cell" end
	local node = core.get_node_or_nil(pos)
	if not node or node.name == "ignore" then return false, "Region not loaded" end
	if placing then
		if node.name ~= "air" then return false, "Cell occupied" end
		if overlaps_player(pos) then return false, "Player occupies cell" end
	elseif core.get_item_group(node.name, "space_material") ~= 1 then
		return false, "This material cannot be removed"
	end
	return true
end
local function rate_limit(session)
	local now = core.get_us_time() / 1000000
	if now - session.last_edit < space.config.edit_interval then return false end
	session.last_edit = now -- invalid requests also consume the budget
	return true
end
local function push(stack, entry)
	stack[#stack + 1] = entry
	if #stack > space.config.history_limit then table.remove(stack, 1) end
end
local function prune_revisions()
	local needed = {}
	for _, session in pairs(building.sessions) do
		for _, stack in ipairs({session.undo, session.redo}) do
			for _, entry in ipairs(stack) do needed[key(entry.pos)] = true end
		end
	end
	for cell in pairs(revisions) do if not needed[cell] then revisions[cell] = nil end end
end
local function edit(player, action)
	local session = building.session(player)
	if not session or not rate_limit(session) then return false, "Build cooldown" end
	local target = building.target(player) -- never accept a client-supplied coordinate
	if not target then return false, "Aim at a surface" end
	if action == "place" and core.is_protected(target.under, player:get_player_name()) then
		return false, "Protected surface"
	end
	local pos = action == "place" and target.above or target.under
	local valid, reason = building.validate(player, pos, action == "place")
	if not valid then return false, reason end
	local before = copy_node(core.get_node(pos))
	local after = action == "place" and {
		name = space.palette[session.material].name, param2 = session.rotation,
	} or {name = "air", param2 = 0}
	core.set_node(pos, after)
	push(session.undo, {pos = vector.new(pos), before = before, after = after,
		revision = record_revision(pos)})
	session.redo = {}
	return true, action == "place" and "Placed" or "Removed"
end
local function history(player, action)
	local session = building.session(player)
	if not session or not rate_limit(session) then return false, "Build cooldown" end
	local source = action == "undo" and session.undo or session.redo
	local destination = action == "undo" and session.redo or session.undo
	local entry = source[#source]
	if not entry then return false, "Nothing to " .. action end
	local expected = action == "undo" and entry.after or entry.before
	local replacement = action == "undo" and entry.before or entry.after
	if revisions[key(entry.pos)] ~= entry.revision or not same(core.get_node_or_nil(entry.pos), expected) then
		table.remove(source)
		return false, "Cell changed since this edit; history skipped"
	end
	local valid, reason = building.validate(player, entry.pos, expected.name == "air")
	if not valid then return false, reason end
	if replacement.name ~= "air" and overlaps_player(entry.pos) then
		return false, "Player occupies cell"
	end
	core.set_node(entry.pos, replacement)
	entry.revision = record_revision(entry.pos)
	-- Adjacent entries in this player's history can refer to the same cell.
	-- Rebase only this player's previous matching edit after our known transition.
	table.remove(source)
	for index = #source, 1, -1 do
		local previous = source[index]
		local previous_expected = action == "undo" and previous.after or previous.before
		if key(previous.pos) == key(entry.pos) then
			if same(previous_expected, replacement) then previous.revision = entry.revision end
			break
		end
	end
	push(destination, entry)
	return true, action == "undo" and "Undone" or "Redone"
end
function building.dispatch(player, action)
	if not authorized(player) then return false, "Building permission required" end
	local session = building.session(player)
	if not session then return false, "Player not ready" end
	if action == "rotate" then
		session.rotation = (session.rotation + 1) % 4
		player:get_meta():set_int("space_rotation", session.rotation)
		return true, "Rotation: " .. session.rotation * 90 .. " degrees"
	elseif action == "place" or action == "remove" then
		return edit(player, action)
	elseif action == "undo" or action == "redo" then
		return history(player, action)
	end
	return false, "Unknown building action"
end
core.register_tool("space_core:builder", {
	description = "Architect tool | Place / Remove | Inventory: palette and rotation",
	inventory_image = "space_builder.png",
	range = space.config.reach,
	node_placement_prediction = "",
	node_dig_prediction = "",
	touch_interaction = "long_dig_short_place",
	on_place = function(stack, player)
		building.dispatch(player, "place")
		return stack
	end,
	on_use = function(stack, player)
		building.dispatch(player, "remove")
		return stack
	end,
	on_drop = function(stack) return stack end,
})
core.register_entity("space_core:preview", {
	initial_properties = {
		physical = false, pointable = false, collide_with_objects = false,
		visual = "cube", visual_size = {x = 1.005, y = 1.005},
		textures = {"space_ghost.png", "space_ghost.png", "space_ghost.png",
			"space_ghost.png", "space_ghost.png", "space_ghost.png"},
		use_texture_alpha = true, glow = 8, static_save = false,
	},
	on_activate = function(self) self.object:set_observers({}) end,
})
core.register_on_joinplayer(function(player)
	local meta = player:get_meta()
	if meta:get_int("space_schema") > space.version then return end
	local material = meta:get_int("space_material")
	if material < 1 or material > #space.palette then material = 1 end
	building.sessions[player:get_player_name()] = {
		material = material, rotation = meta:get_int("space_rotation") % 4,
		last_edit = -math.huge, undo = {}, redo = {},
	}
	local inventory = player:get_inventory()
	inventory:set_size("main", 1)
	inventory:set_stack("main", 1, "space_core:builder")
	player:hud_set_hotbar_itemcount(1)
end)
core.register_allow_player_inventory_action(function() return 0 end)
core.register_on_leaveplayer(function(player)
	local session = building.session(player)
	if session and session.preview and session.preview:get_pos() then session.preview:remove() end
	building.sessions[player:get_player_name()] = nil
	-- Keep conflict tokens only while sessions reference them (bounded history).
	prune_revisions()
end)
local timer = 0
local cleanup_timer = 0
core.register_globalstep(function(dtime)
	timer = timer + dtime
	if timer < space.config.preview_interval then return end
	cleanup_timer = cleanup_timer + timer
	timer = 0 -- no catch-up loop after a server stall
	for _, player in ipairs(core.get_connected_players()) do
		local session = building.session(player)
		if session then
			local active = player:get_wielded_item():get_name() == "space_core:builder"
			local action = space.actions.from_control(player:get_player_control())
			if active and action.rotate and not session.rotate_held then
				building.dispatch(player, "rotate")
			end
			session.rotate_held = action.rotate
			if active and action.remove then building.dispatch(player, "remove") end
			local target = active and building.target(player)
			if target then
				local valid = building.validate(player, target.above, true)
					and not core.is_protected(target.under, player:get_player_name())
				local signature = key(target.above) .. ":" .. tostring(valid)
					.. ":" .. session.material .. ":" .. session.rotation
				if not session.preview or not session.preview:get_pos() then
					session.preview = core.add_entity(target.above, "space_core:preview")
					session.preview_signature = nil
					if session.preview then
						session.preview:set_observers({[player:get_player_name()] = true})
					end
				end
				if session.preview and signature ~= session.preview_signature then
					session.preview:set_pos(target.above)
					session.preview:set_yaw(core.dir_to_yaw(core.fourdir_to_dir(session.rotation)))
					local texture = space.palette[session.material].texture
						.. "^[colorize:" .. (valid and "#70ffca" or "#ff596b") .. ":95^[opacity:95"
					local textures = {texture, texture, texture, texture, texture, texture}
					session.preview:set_properties({textures = textures})
					session.preview_signature = signature
				end
			elseif session.preview and session.preview:get_pos() then
				session.preview:remove()
				session.preview = nil
				session.preview_signature = nil
			end
		end
	end
	-- No world-size revision map: keep only cells referenced by bounded histories.
	if cleanup_timer >= 10 then
		cleanup_timer = 0
		prune_revisions()
	end
end)
