// hack jquery to cache lookups
var cache = {};
function cached_$(query) {
	if (cache[query] !== undefined) {
		return cache[query];
	} else {
		cache[query] = $(query);
		return cache[query];
	}
}


function updateCommsStatus(status) {
	var heading = cached_$('#config-heading');
	heading.removeClass("btn-info");
	heading.removeClass("btn-warning");
	heading.removeClass("btn-danger");
	heading.removeClass("btn-success");
	var status_span = cached_$('#config-status');
	status_span.removeClass("label-info");
	status_span.removeClass("label-warning");
	status_span.removeClass("label-danger");
	status_span.removeClass("label-success");
	switch(status) {
		case "COMMS_UP":
			heading.addClass("btn-success")
			status_span.addClass("label-success");
			status_span.text("Connected to Server");
			break;
		case "COMMS_DOWN":
			heading.addClass("btn-warning")
			status_span.addClass("label-warning");
			status_span.text("LCM Communications Offline...")
			break;
		case "INFO_FAILED":
			heading.addClass("btn-danger")
			status_span.addClass("label-danger");
			status_span.text("Can't Connect to Flask Server...")
			break;
		default:
			heading.addClass("btn-danger")
			status_span.addClass("label-danger");
			status_span.text("Unknown Error")
	}
}

function updateGameClock(data) {
	var mode = data['stage_name'];
	var stage_time = data['stage_time'];
	var total_stage_time = data['total_stage_time'];
	// convert input "gametime" into 
	var time = total_stage_time - stage_time;

	var minutes = Math.floor(time / 60);
	var seconds = Math.floor(time % 60);
	var disp_seconds = Math.ceil(time % 60);

	var hr_seconds;
	if (disp_seconds < 10) {
		hr_seconds = "0" + String(disp_seconds);
	} else {
		hr_seconds = String(disp_seconds);
	}
	var hr_time = String(minutes) + ":" + hr_seconds;
	var game_clock = cached_$('#game-clock');
	game_clock.text(hr_time);

	var clock_bar = cached_$('#clock-bar');
	clock_bar.css("width", String(time / total_stage_time * 100) + "%");
	clock_bar.removeClass("progress-bar-info");
	clock_bar.removeClass("progress-bar-warning");
	clock_bar.removeClass("progress-bar-danger");
	if (time > 30) {
	} else if (time <= 10) {
		clock_bar.addClass("progress-bar-danger");
	} else if (time <= 30) {
		clock_bar.addClass("progress-bar-warning");
	}

	var bonus_bar = cached_$('#bonus-bar');
	var bonus_time = data['bonus_time']
	bonus_bar.css("width", String(bonus_time / 30 * 100) + "%");

	var game_mode_div = cached_$('#game-mode');
	switch (mode) {
		case "Setup":
			game_mode_div.text("Setup");
			clock_bar.css("width", "100%");
			break;
		case "Teleop":
			game_mode_div.text("Teleoperated Mode");
			break;
		case "Autonomous":
			game_mode_div.text("Autonomous Mode");
			break;
		case "Paused":
			game_mode_div.text("Match Paused");
			break;
		case "End":
			game_mode_div.text("Match Ended");
			break;
		default:
			game_mode_div.text("Unknown Mode");
			break;
	}
}

function updateScore(data) {
	// update the team names
	var team_numbers = data['team_numbers'];
	var team_names = data['team_names'];
	var team_strings = new Array();
    var i;
	for (i = 2; i < 4; i++) {
		team_strings[i] = String(team_numbers[i]) + " " + team_names[i];
		cached_$('#team' + String(i)).text(team_strings[i]);
	}
	for (i = 0; i < 2; i++) {
		team_strings[i] = team_names[i] + " " + String(team_numbers[i]);
		cached_$('#team' + String(i)).text(team_strings[i]);
	}
	// update match number
	var match_number = data['match_number'];
	cached_$('#match-number').text(match_number)


	// update the scores
	var blue_scores = data['blue_points'];
	var gold_scores = data['gold_points'];
	cached_$('#blue-total-score').text(blue_scores[0]);
	cached_$('#gold-total-score').text(gold_scores[0]);
	cached_$('#blue-autonomous-points').text(blue_scores[1]);
	cached_$('#gold-autonomous-points').text(gold_scores[1]);
	cached_$('#blue-normal-points').text(blue_scores[2]);
	cached_$('#gold-normal-points').text(gold_scores[2]);
	cached_$('#blue-permanent-points').text(blue_scores[3]);
	cached_$('#gold-permanent-points').text(gold_scores[3]);
	cached_$('#blue-penalties').text(-blue_scores[4]);
	cached_$('#gold-penalties').text(-gold_scores[4]);

  if (data['bonus_possession'] == 2) {
		cached_$('#blue-bonus-points').text(data['bonus_points'])
		cached_$('#gold-bonus-points').text("");
  } else if (data['bonus_possession'] == 1) {
		cached_$('#blue-bonus-points').text("");
		cached_$('#gold-bonus-points').text(data['bonus_points'])
  } else {
		cached_$('#blue-bonus-points').text("");
		cached_$('#gold-bonus-points').text("");
  }

	cached_$('#old_blue_total_score').text(blue_scores[0]);
	cached_$('#old_gold_total_score').text(gold_scores[0]);
	cached_$('#old_blue_autonomous_points').text(blue_scores[1]);
	cached_$('#old_gold_autonomous_points').text(gold_scores[1]);
	cached_$('#old_blue_normal_points').text(blue_scores[2]);
	cached_$('#old_gold_normal_points').text(gold_scores[2]);
	cached_$('#old_blue_permanent_points').text(blue_scores[3]);
	cached_$('#old_gold_permanent_points').text(gold_scores[3]);
	cached_$('#old_blue_penalty').text(blue_scores[4]);
	cached_$('#old_gold_penalty').text(gold_scores[4]);
	cached_$('#old_bonus_points').text(data['bonus_points']);
	recalculateTotals();
}

function updateHeartbeat(data) {
	var hb = cached_$('#heartbeat');
	if (data['stored_a']) {
		hb.addClass('btn-info');
	} else {
		hb.removeClass('btn-info');
	}
}

function processInfo(data) {
	updateCommsStatus(data['comms_status']);
	updateGameClock(data);
	updateScore(data);
	updateHeartbeat(data);
}

function failedToGetInfo() {
	updateCommsStatus("INFO_FAILED");
}
		
function updateInterface() {
	// set wall clock
	time = new Date().toLocaleTimeString();
	cached_$('#wall-clock').text(time);

	$.get('/api/v1/all-info', {}, processInfo).fail(failedToGetInfo);
}

function submitAdjustment(e) {
	e.preventDefault();
	$.post('/api/v1/score-delta', $(this).serialize());
	recalculateTotals();
	cached_$('#adjust-form')[0].reset();
}

function totalHelper(name) {
  cached_$("#new_" + name).val(parseInt($("#old_" + name).text()) + parseInt($("input[name=" + name + "]").val()));
}

function diffHelper(name) {
  cached_$("input[name=" + name + "]").val(parseInt($("#new_" + name).val()) - parseInt($("#old_" + name).text()));
}

function recalculateTotals() {
  totalHelper("blue_autonomous_points");
  totalHelper("gold_autonomous_points");
  totalHelper("blue_normal_points");
  totalHelper("gold_normal_points");
  totalHelper("blue_permanent_points");
  totalHelper("gold_permanent_points");
  totalHelper("blue_penalty");
  totalHelper("gold_penalty");
  totalHelper("bonus_points");

  recalculateSum();
}

function recalculateDiffs() {
  diffHelper("blue_autonomous_points");
  diffHelper("gold_autonomous_points");
  diffHelper("blue_normal_points");
  diffHelper("gold_normal_points");
  diffHelper("blue_permanent_points");
  diffHelper("gold_permanent_points");
  diffHelper("blue_penalty");
  diffHelper("gold_penalty");
  diffHelper("bonus_points");

  recalculateSum();
}

function recalculateSum() {
  cached_$("#new_blue_total_score").text(
	parseInt(cached_$("#new_blue_autonomous_points").val()) +
	  parseInt(cached_$("#new_blue_normal_points").val()) +
	  parseInt(cached_$("#new_blue_permanent_points").val()) +
      (parseInt(cached_$("#blue-bonus-points").text()) || 0) -
	  parseInt(cached_$("#new_blue_penalty").val())
  );
  cached_$("#diff_blue_total_score").text(
	parseInt(cached_$("#new_blue_total_score").text()) -
	  parseInt(cached_$("#old_blue_total_score").text()));
  cached_$("#new_gold_total_score").text(
	parseInt(cached_$("#new_gold_autonomous_points").val()) +
	  parseInt(cached_$("#new_gold_normal_points").val()) +
	  parseInt(cached_$("#new_gold_permanent_points").val()) +
      (parseInt(cached_$("#gold-bonus-points").text()) || 0) -
	  parseInt(cached_$("#new_gold_penalty").val())
  );
  cached_$("#diff_gold_total_score").text(
	parseInt(cached_$("#new_gold_total_score").text()) -
	  parseInt(cached_$("#old_gold_total_score").text()));
}

$( document ).ready(function($) {
	window.setInterval(updateInterface, 200);
	$('#heartbeat').tooltip({title: "Press the guide button", placement: 'bottom'});
	$('form').submit(submitAdjustment);
	$('input.diff').on('input', recalculateTotals);
	$('input.new').on('input', recalculateDiffs);
});
