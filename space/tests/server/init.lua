-- SPDX-License-Identifier: LGPL-2.1-or-later
-- Installed only into a newly created temporary test world by runtime.py.
local placed = {x = 4, y = 31, z = 0}
local ready, confirmations = {}, {}
local started, generated = false, false
local phase = "connect"
local round = core.settings:get("space_test_round")
local function marker(name)
	local file = assert(io.open(core.get_worldpath() .. "/" .. name, "w"))
	file:write("ok\n")
	file:close()
end
local function checked(run)
	local ok, error_message = pcall(run)
	if not ok then
		core.log("error", "SPACE_TEST_FAILED: " .. tostring(error_message))
		marker("failure")
		core.request_shutdown("Test failed", false, 0)
	end
end
local function tell(message) core.chat_send_all("SPACE_TEST_" .. message) end
local function begin()
	if started or not generated or not ready.space_a or not ready.space_b then return end
	started = true
	checked(function()
		assert(#core.get_connected_players() == 2, "two native players required")
		assert(core.get_node({x = 0, y = 30, z = 0}).name == "space_core:anchor", "island generation")
		if round == "reload" then
			local node = core.get_node(placed)
			assert(node.name == "space_core:copper" and node.param2 == 1, "saved rotation/material")
			local player = core.get_player_by_name("space_a")
			assert(player:get_meta():get_int("space_material") == 3, "saved material choice")
			assert(player:get_meta():get_int("space_rotation") == 1, "saved rotation choice")
			assert(vector.distance(player:get_pos(), {x = 4, y = 34, z = 0}) < 0.1, "saved player position")
			assert(#space.building.session(player).undo == 0, "history resets on reload")
			phase = "reload"
			tell("RELOAD")
		else
			assert(core.get_node(placed).name == "air", "new world above launch garden")
			for _, player in ipairs(core.get_connected_players()) do
				player:set_pos({x = player:get_player_name() == "space_a" and 4 or 6, y = 34, z = 0})
				player:set_look_vertical(math.pi / 2)
				player:set_look_horizontal(0)
			end
			local player = core.get_player_by_name("space_a")
			space.building.session(player).material = 3
			player:get_meta():set_int("space_material", 3)
			phase = "place"
			core.after(0.5, tell, "PLACE")
		end
	end)
end
core.register_on_joinplayer(function()
	if generated then return end
	if phase ~= "connect" then return end
	-- emerge_area invokes callback per mapblock; only final callback proceeds.
	phase = "generate"
	core.emerge_area({x = -16, y = 16, z = -16}, {x = 16, y = 48, z = 16}, function(_, action, remaining)
		checked(function()
			assert(action ~= core.EMERGE_ERRORED and action ~= core.EMERGE_CANCELLED,
				"emerge failed, action=" .. tostring(action))
			if remaining == 0 then generated = true; begin() end
		end)
	end)
end)
core.register_chatcommand("spacetest", {
	func = function(name, parameter)
		if name ~= "space_a" and name ~= "space_b" then return false end
		checked(function()
			if parameter == "ready" then ready[name] = true; begin(); return end
			if parameter == "placed" and name == "space_a" then
				local node = core.get_node(placed)
				assert(node.name == "space_core:copper" and node.param2 == 1, "network placement command")
				local session = space.building.session(core.get_player_by_name(name))
				assert(session.preview and session.preview:get_pos(), "preview entity exists")
				assert(session.preview:get_observers()[name] and not session.preview:get_observers().space_b,
					"preview is private")
				phase = "see_place"; confirmations = {}; tell("SEE_PLACE")
			elseif parameter == "saw_place" then
				assert(phase == "see_place", "unexpected place confirmation")
				confirmations[name] = true
				if confirmations.space_a and confirmations.space_b then phase = "remove"; tell("REMOVE") end
			elseif parameter == "removed" and name == "space_a" then
				assert(core.get_node(placed).name == "air", "network remove command")
				phase = "see_remove"; confirmations = {}; tell("SEE_REMOVE")
			elseif parameter == "saw_remove" then
				assert(phase == "see_remove", "unexpected remove confirmation")
				confirmations[name] = true
				if confirmations.space_a and confirmations.space_b then phase = "undo"; tell("UNDO") end
			elseif parameter == "undone" and name == "space_a" then
				assert(core.get_node(placed).name == "space_core:copper", "network undo command")
				phase = "final"; confirmations = {}; tell("FINAL")
			elseif parameter == "final" or parameter == "reloaded" then
				assert(phase == "final" or phase == "reload", "unexpected final confirmation")
				confirmations[name] = true
				if confirmations.space_a and confirmations.space_b then
					marker("success")
					core.log("action", "SPACE_TEST_PASSED: " .. round)
					core.request_shutdown("Tests complete", false, 0)
				end
			elseif parameter == "failed" then error("client assertion failed: " .. name) end
		end)
		return true
	end,
})
