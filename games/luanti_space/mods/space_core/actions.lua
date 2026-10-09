-- SPDX-License-Identifier: LGPL-2.1-or-later
-- Pure adapter: input devices already converge in Luanti's PlayerControl.
-- Native LocalPlayer consumes this same underlying control for predicted flight.
local actions = {}
local function axis(value, positive, negative)
	if type(value) == "number" and value == value then
		return math.max(-1, math.min(1, value))
	end
	return (positive and 1 or 0) - (negative and 1 or 0)
end
function actions.from_control(control)
	return {
		move_forward = axis(control.movement_y, control.up, control.down),
		move_right = axis(control.movement_x, control.right, control.left),
		ascend = control.jump == true,
		descend = control.sneak == true,
		boost = control.aux1 == true,
		place = control.place == true,
		remove = control.dig == true,
		-- Stock zoom binding acts as the rotation action with the builder.
		-- The game does not grant zoom; touch users also have a menu button.
		rotate = control.zoom == true,
	}
end
function actions.vertical(action)
	return (action.ascend and 1 or 0) - (action.descend and 1 or 0)
end
return actions
