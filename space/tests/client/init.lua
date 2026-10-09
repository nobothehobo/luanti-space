-- SPDX-License-Identifier: LGPL-2.1-or-later
local wait_for, expected, sent_ready = nil, nil, false
local position = {x = 4, y = 31, z = 0}
local function report(message) core.send_chat_message("/spacetest " .. message) end
local function later(delay, command) core.after(delay, core.send_chat_message, command) end
core.register_on_receiving_chat_message(function(message)
	message = core.strip_colors(message)
	if not message:find("SPACE_TEST_", 1, true) then return end
	local name = core.localplayer:get_name()
	if message:find("SPACE_TEST_PLACE", 1, true) and name == "space_a" then
		later(0.3, "/space rotate")
		later(0.6, "/space place")
		later(1.0, "/spacetest placed")
	elseif message:find("SPACE_TEST_SEE_PLACE", 1, true) then
		wait_for, expected = "saw_place", "space_core:copper"
	elseif message:find("SPACE_TEST_REMOVE", 1, true) and name == "space_a" then
		later(0.3, "/space remove")
		later(0.7, "/spacetest removed")
	elseif message:find("SPACE_TEST_SEE_REMOVE", 1, true) then
		wait_for, expected = "saw_remove", "air"
	elseif message:find("SPACE_TEST_UNDO", 1, true) and name == "space_a" then
		later(0.3, "/space undo")
		later(0.7, "/spacetest undone")
	elseif message:find("SPACE_TEST_FINAL", 1, true) then
		wait_for, expected = "final", "space_core:copper"
	elseif message:find("SPACE_TEST_RELOAD", 1, true) then
		wait_for, expected = "reloaded", "space_core:copper"
	end
end)
core.register_globalstep(function()
	if not core.localplayer then return end
	local physics = core.localplayer:get_physics_override()
	if not sent_ready and physics.gravity == 0
		and core.localplayer:get_wielded_item():get_name() == "space_core:builder" then
		sent_ready = true
		report("ready")
	end
	if wait_for then
		local node = core.get_node_or_nil(position)
		if node and node.name == expected then
			if expected ~= "air" and node.param2 ~= 1 then report("failed"); wait_for = nil; return end
			local response = wait_for
			wait_for = nil
			report(response)
		end
	end
end)
