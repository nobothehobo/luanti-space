-- SPDX-License-Identifier: LGPL-2.1-or-later
space = {version = 1}
local path = core.get_modpath(core.get_current_modname())
space.actions = dofile(path .. "/actions.lua")
for _, module in ipairs({"config", "materials", "world", "flight", "building", "interface"}) do
	dofile(path .. "/" .. module .. ".lua")
end
