from __future__ import print_function

import forseti2
import configurator
import json
import lcm
import threading
import time
import random
import os
import settings
import util
import LCMNode
import requests

LCMNode = LCMNode.LCMNode

class Schedule(LCMNode):

    matches_dir = '../matches'

    def __init__(self, lc):
        self.lc = lc
        self.matches = {}
        self.current_match = None
        self.totals = {}
        self.score_states = {}
        self.lc.subscribe('Match/Save', self.handle_save)
        self.lc.subscribe('Schedule/Load', self.handle_load)
        self.lc.subscribe('Match/Init', self.handle_init)
        self.lc.subscribe('Match/Submit', self.handle_submit)
        self.lc.subscribe('score/state', self.handle_score)
        self.seq_score = util.LCMSequence(self.lc, forseti2.score_delta, "score/delta")
        self.start_thread()

    def clear(self):
        self.matches = {}

    def load(self, clear_first=True):
        if clear_first:
            self.clear()
        i = 1
        for filename in os.listdir(self.matches_dir):
            try:
                try:
                    i = int(filename.split('.')[-2])
                except IndexError:
                    i = random.getrandbits(31)
                with open(os.path.join(self.matches_dir, filename)) as wfile:
                    self.matches[i] = json.load(wfile)
                    self.load_team_names(self.matches[i])
            except Exception:
                print('Could not load match', filename)

    def send_schedule(self):
        schedule = forseti2.Schedule()
        for idx, match in self.matches.items():
            out_match = forseti2.Match()
            i = 0
            for alliance in [u'alliance1', u'alliance2']:
                for team in [u'team1', u'team2']:
                    print(match[alliance])
                    out_match.team_numbers[i] = match[alliance][team]
                    out_match.team_names[i] = \
                        match[alliance].get(u'{}_name'.format(team),
                            'Unknown Team')
                    i += 1
            out_match.match_number = idx;
            schedule.matches.append(out_match)
        schedule.num_matches = len(schedule.matches)

        self.lc.publish('Schedule/Schedule', schedule.encode())

    def load_team_names(self, match):
        for alliance in [u'alliance1', u'alliance2']:
            for team in [u'team1', u'team2']:
                match[alliance][u'{}_name'.format(team)] = \
                    configurator.get_team_name(match[alliance][team])

    def handle_save(self, channel, data):
        msg = forseti2.Match.decode(data)
        self.matches[msg.match_number] = {
                u'alliance1':
                {
                    u'team1': msg.team_numbers[0],
                    u'team1_name': msg.team_names[0],
                    u'team2': msg.team_numbers[1],
                    u'team2_name': msg.team_names[1],
                },
                u'alliance2':
                {
                    u'team1': msg.team_numbers[2],
                    u'team1_name': msg.team_names[2],
                    u'team2': msg.team_numbers[3],
                    u'team2_name': msg.team_names[3],
                }}
        try:
            filename = '{}.match'.format(msg.match_number)
            with open(os.path.join(self.matches_dir, filename), 'w') as wfile:
                json.dump(self.matches[msg.match_number], wfile)
        except Exception as ex:
            print('Could not save match', self.matches[msg.match_number],
                  'got exception', ex)
        self.send_schedule()

    def handle_load(self, channel, data):
        print('Loading!')
        msg = forseti2.ScheduleLoadCommand.decode(data)
        self.load(bool(msg.clear_first))
        self.send_schedule()

    def handle_init(self, channel, data):
        msg = forseti2.Match.decode(data)
        configurator.do_config(self.lc, msg.team_numbers, msg.gold_items_loc, msg.blue_items_loc)
        #self.timer.start()

        # Reset the scores
        self.seq_score.publish(action_reset=True)
        self.current_match = msg.match_number
        self.totals[msg.match_number] = {'alliance1': 0, 'alliance2': 0}

    def handle_submit(self, channel, data):
        msg = forseti2.Match.decode(data)
        if self.current_match is None:
            print("WARNING: no current match")
            return
        elif self.current_match not in self.totals:
            print("WARNING: no scores available for match")
            return
        elif msg.match_number != self.current_match:
            print("WARNING: match number mismatch when submitting score")
            return

        print ("FINAL SCORE OF MATCH {} is: Blue {} | {} Gold".format(
            msg.match_number,
            self.totals[msg.match_number]['alliance1'],
            self.totals[msg.match_number]['alliance2']
            ))

        match_num = msg.match_number
        # TODO: Put the score determining logic in handle_score
        score_state = self.score_states[match_num]
        bonus_points = [0, 0]
        # Note: possession is defined as the bonus ball being on your side of the field
        # If the blue alliance has possession, the gold alliance gets the points
        if score_state.bonus_possession == forseti2.score_state.BLUE:
            bonus_points[1] += score_state.bonus_points
        if score_state.bonus_possession == forseti2.score_state.GOLD:
            bonus_points[0] += score_state.bonus_points
        a1 = {
            "autonomous" : score_state.blue_autonomous_points, 
            "bonus" : bonus_points[0], 
            "manual" : score_state.blue_normal_points + score_state.blue_permanent_points, 
            "penalty" : score_state.blue_penalty, 
            "team1" : {
                "number" : msg.team_numbers[0],
                "disqualified" : False
            }, 
            "team2" : {
                "number" : msg.team_numbers[1],
                "disqualified" : False
            }
        }
        a2 = {
            "autonomous" : score_state.gold_autonomous_points, 
            "bonus" : bonus_points[1], 
            "manual" : score_state.gold_normal_points + score_state.gold_permanent_points, 
            "penalty" : score_state.gold_penalty, 
            "team1" : {
                "number" : msg.team_numbers[2],
                "disqualified" : False
            }, 
            "team2" : {
                "number" : msg.team_numbers[3],
                "disqualified" : False
            }
        }
        args = {"alliance1" : a1, "alliance2" : a2}
        r = requests.post('https://pioneers.berkeley.edu/match_schedule/api/match/{}/'.format(msg.match_number), json.dumps(args))

    def handle_score(self, channel, data):
        msg = forseti2.score_state.decode(data)
        if self.current_match is not None and self.current_match in self.totals:
            self.totals[self.current_match]['alliance1'] = msg.blue_total
            self.totals[self.current_match]['alliance2'] = msg.gold_total
            self.score_states[self.current_match] = msg


def main():
    lc = lcm.LCM(settings.LCM_URI)
    sched = Schedule(lc)
    sched.load()
    while(True):
        time.sleep(1)

if __name__ == '__main__':
    main()
