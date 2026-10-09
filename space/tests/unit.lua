-- SPDX-License-Identifier: LGPL-2.1-or-later
-- Run from the repository root: lua5.1 space/tests/unit.lua
local path = "games/luanti_space/mods/space_core/"
space = {version = 1, actions = dofile(path .. "actions.lua")}
dofile(path .. "config.lua")
local count = 0
local function test(title, run)
	run()
	count = count + 1
	print("PASS " .. title)
end
test("analog and keyboard inputs have identical action meaning", function()
	local analog = space.actions.from_control({movement_x = -0.6, movement_y = 0.8, jump = true, aux1 = true})
	assert(analog.move_right == -0.6 and analog.move_forward == 0.8 and analog.boost)
	local keyboard = space.actions.from_control({up = true, right = true, sneak = true, zoom = true})
	assert(keyboard.move_forward == 1 and keyboard.move_right == 1 and keyboard.rotate)
	assert(space.actions.vertical(analog) == 1 and space.actions.vertical(keyboard) == -1)
	assert(space.actions.vertical({ascend = true, descend = true}) == 0)
end)
test("malformed analog and cell data are bounded", function()
	local action = space.actions.from_control({movement_x = math.huge, movement_y = 0 / 0})
	assert(action.move_right == 1 and action.move_forward == 0)
	assert(not space.valid_cell({x = 0 / 0, y = 0, z = 0}))
	assert(not space.valid_cell({x = 0, y = math.huge, z = 0}))
	assert(not space.valid_cell({x = 0.5, y = 0, z = 0}))
	assert(not space.valid_cell({x = 30001, y = 0, z = 0}))
	assert(not space.valid_cell({x = 0, y = 0}))
end)
local map, callbacks, definitions = {}, {join = {}, leave = {}, step = {}}, {}
local time, protected = 1000000, false
local function cell(pos) return pos.x .. ":" .. pos.y .. ":" .. pos.z end
local function node(pos) return map[cell(pos)] or {name = "air", param2 = 0} end
vector = {
	new = function(pos) return {x = pos.x, y = pos.y, z = pos.z} end,
	add = function(a, b) return {x = a.x + b.x, y = a.y + b.y, z = a.z + b.z} end,
	multiply = function(a, n) return {x = a.x * n, y = a.y * n, z = a.z * n} end,
	distance = function(a, b) return math.sqrt((a.x-b.x)^2 + (a.y-b.y)^2 + (a.z-b.z)^2) end,
}
local players = {}
core = {
	register_on_joinplayer = function(cb) callbacks.join[#callbacks.join+1] = cb end,
	register_on_leaveplayer = function(cb) callbacks.leave[#callbacks.leave+1] = cb end,
	register_globalstep = function(cb) callbacks.step[#callbacks.step+1] = cb end,
	register_allow_player_inventory_action = function() end,
	register_node = function(name, def) definitions[name] = def end,
	register_tool = function(name, def) definitions[name] = def end,
	register_alias = function() end, register_entity = function() end,
	check_player_privs = function(player) return player.permission end,
	is_protected = function() return protected end,
	get_node = node, get_node_or_nil = node,
	set_node = function(pos, value) map[cell(pos)] = {name = value.name, param2 = value.param2 or 0} end,
	get_us_time = function() return time end,
	get_item_group = function(name, group)
		return definitions[name] and definitions[name].groups and definitions[name].groups[group] or 0
	end,
	get_connected_players = function() return players end,
}
dofile(path .. "materials.lua")
dofile(path .. "building.lua")
local function player(name)
	local fields = {}
	local p = {permission = true, pos = {x = 0, y = 0, z = 0}}
	function p:get_player_name() return name end
	function p:is_player() return true end
	function p:get_pos() return self.pos end
	function p:get_properties() return {eye_height = 1.625, collisionbox = {-0.3,0,-0.3,0.3,1.75,0.3}} end
	function p:get_meta() return {
		get_int = function(_, key) return fields[key] or 0 end,
		set_int = function(_, key, value) fields[key] = value end,
	} end
	function p:get_inventory() return {set_size = function() end, set_stack = function() end} end
	function p:hud_set_hotbar_itemcount() end
	for _, cb in ipairs(callbacks.join) do cb(p) end
	return p
end
local alice, bob = player("alice"), player("bob")
players = {alice, bob}
bob.pos = {x = -5, y = 0, z = 0}
local target = {type = "node", under = {x = 3, y = 0, z = 0}, above = {x = 3, y = 1, z = 0}}
space.building.target = function() return target end -- targeting itself is covered in native tests
local function dispatch(p, action)
	time = time + 200000
	return space.building.dispatch(p, action)
end
test("server accepts place, rotation and remove via one service", function()
	assert(dispatch(alice, "rotate"))
	assert(dispatch(alice, "place"))
	assert(node(target.above).name == "space_core:alloy" and node(target.above).param2 == 1)
	target.under = vector.new(target.above)
	assert(dispatch(alice, "remove"))
	assert(node(target.under).name == "air")
end)
test("same-cell history round-trips without losing rotation", function()
	assert(dispatch(alice, "undo"))
	assert(node(target.under).param2 == 1)
	assert(dispatch(alice, "undo"))
	assert(node(target.under).name == "air")
	assert(dispatch(alice, "redo"))
	assert(node(target.under).param2 == 1)
	assert(dispatch(alice, "redo"))
	assert(node(target.under).name == "air")
end)
test("conflicting multiplayer edits never overwrite another player's edit", function()
	assert(dispatch(alice, "place"))
	assert(dispatch(bob, "remove"))
	assert(dispatch(bob, "place")) -- same value (ABA), newer revision
	local ok, reason = dispatch(alice, "undo")
	assert(not ok and reason:find("changed"))
	assert(node(target.above).name == "space_core:alloy")
end)
test("permission, protection, loaded region, reach and collision checks", function()
	alice.permission = false
	assert(not dispatch(alice, "remove"))
	alice.permission = true
	protected = true
	assert(not dispatch(alice, "remove"))
	protected = false
	assert(not space.building.validate(alice, {x = 20, y = 0, z = 0}, true))
	assert(not space.building.validate(alice, {x = 0, y = 1, z = 0}, true))
	assert(not space.building.validate(alice, target.above, true))
	map["5:1:0"] = {name = "ignore", param2 = 0}
	assert(not space.building.validate(alice, {x = 5, y = 1, z = 0}, true))
	map["6:1:0"] = {name = "space_core:anchor", param2 = 0}
	assert(not space.building.validate(alice, {x = 6, y = 1, z = 0}, false))
	assert(not dispatch(alice, "bogus"))
end)
test("edit requests are throttled and history is bounded", function()
	assert(dispatch(bob, "remove"))
	local ok, reason = space.building.dispatch(bob, "place")
	assert(not ok and reason == "Build cooldown")
	for _ = 1, 80 do assert(dispatch(bob, "place")); assert(dispatch(bob, "remove")) end
	assert(#space.building.session(bob).undo == space.config.history_limit)
end)
test("history cannot restore a block inside a player", function()
	alice.pos = vector.new(target.above)
	local ok = dispatch(bob, "undo")
	assert(not ok and node(target.above).name == "air")
	alice.pos = {x = 0, y = 0, z = 0}
end)
print(string.format("%d behavior tests passed", count))
