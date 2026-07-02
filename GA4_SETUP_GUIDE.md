# 📊 GA4 Analytics Setup Guide — JVDesignStudio

Your site now has **enterprise-grade GA4 tracking** with custom events, user properties, and conversion goals. This guide shows you how to configure your GA4 dashboard to get full insights.

---

## 🎯 What's Already Tracking

### ✅ Custom Events Implemented
- `game_start` — Game launches with ID, name, difficulty
- `game_end` — Game completion with score, level, time spent, win status
- `game_score` — Score updates with high score tracking
- `game_achievement` — In-game achievements unlocked
- `game_level_up` — Player level ups with XP earned
- `workshop_start` — Workshop sessions started
- `workshop_complete` — Workshop completion with difficulty, time spent
- `quiz_attempt` — Quiz submissions with pass/fail, score
- `quest_start` — Quest initiations with difficulty tracking
- `quest_complete` — Quest completion with XP rewards and unlock types
- `quest_abandoned` — Incomplete quest tracking
- `cosmetic_unlock` — Cosmetic rewards with unlock method (quest/achievement/game)
- `player_level_up` — Global player level milestones
- `play_streak` — Daily play streak tracking
- `achievement_unlock` — Major achievement unlocks
- `page_view` — Page views with type (game, workshop, hub, profile, leaderboard)
- `filter_leaderboard` — Leaderboard filter interactions
- `funnel_step` — Quest completion funnel tracking

### ✅ User Properties Tracked
- `player_level` — Current player level
- `total_xp` — Cumulative XP earned
- `workshops_completed` — Total workshops finished
- `quests_completed` — Total quests finished
- `games_played` — Total games played
- `cosmetics_unlocked` — Total cosmetics obtained
- `daily_streak` — Current play streak

### ✅ Ecommerce Tracking
- Cosmetic unlocks tracked as "purchases"
- Quest completions tracked as conversions
- XP normalized as currency value

### ✅ Conversion Goals Ready
- Quest completions (funnel tracking)
- Cosmetic unlocks
- Player level milestones (every 5 levels)
- Play streaks (7, 14, 30, 60, 100 days)
- Achievement unlocks

---

## 🔧 GA4 Dashboard Setup (Manual Configuration Required)

### Step 1: Create Custom Dimensions
Go to **Admin → Custom Definitions → Custom Dimensions** and add:

| Dimension Name | Event Parameter | Description |
|---|---|---|
| Game ID | `game_id` | Game identifier for player |
| Quest ID | `quest_id` | Quest identifier |
| Difficulty | `difficulty` | Game/quest difficulty level |
| Game Name | `game_name` | Human-readable game name |
| Quest Name | `quest_name` | Human-readable quest name |
| Player Level | `user_properties.player_level` | Current player level |
| Session ID | `session_id` | Unique session tracker |

### Step 2: Create Custom Metrics
Go to **Admin → Custom Definitions → Custom Metrics** and add:

| Metric Name | Event Parameter | Aggregation Type |
|---|---|---|
| Game Score | `score` | Sum |
| XP Earned | `xp_earned` or `xp_reward` | Sum |
| Time Spent (sec) | `time_spent_seconds` | Sum |
| Game Level | `level` | Average |
| Quest Count | `quest_id` | Count Distinct |

### Step 3: Set Up Conversion Events
Go to **Admin → Conversions** and mark these as conversions:

1. **`quest_complete`** → Quest Completion
2. **`cosmetic_unlock`** → Cosmetic Reward
3. **`purchase`** → Ecommerce Purchase (cosmetics)
4. **`player_level_up`** → Level Milestone
5. **`play_streak`** → Streak Milestone

---

## 📈 Recommended Dashboard Views

### Dashboard 1: Game Performance
**Cards to add:**
- Game Start → Game End funnel
- Average Score by Game
- Game Level Progression
- High Score Rate

**Filters:**
- Dimension: Game Name
- Metric: Score (Sum)

---

### Dashboard 2: Quest Progression Funnel
**Cards to add:**
- Page View (quest board) → Quest Start → Quest Complete
- Quest Completion Rate by Difficulty
- XP Earned from Quests
- Most Popular Quests

**Segments:**
- Group by: Quest Name
- Metric: Conversion Rate

---

### Dashboard 3: Player Engagement
**Cards to add:**
- Daily Active Users
- Player Level Distribution
- Average Session Duration
- Play Streak Distribution
- Cosmetics Unlocked (trending)

**Custom Report:**
```
Dimension: Player Level
Metrics: 
  - Event Count (game_start, quest_complete, workshop_complete)
  - Active Users
```

---

### Dashboard 4: User Acquisition & Retention
**Cards to add:**
- New vs Returning Users (by user_id)
- Daily Active Users (DAU)
- Cohort Analysis (retention by signup date)
- Engagement Over Time

**Cohort Settings:**
- Cohort Type: First Session Date
- Metric: Game Start Events

---

### Dashboard 5: Conversion Funnel
**Cards to add:**
- Page View → Game Start → Game End (conversion to quest)
- Workshop Start → Quiz Attempt → Quest Start
- Quest View → Quest Start → Quest Complete

---

## 🎮 Key Reports to Create

### Report 1: Game Mastery
```
Rows: Game Name
Columns: 
  - Game Starts
  - Games Completed
  - Average Score
  - Players with High Score
```

### Report 2: Learning Path Progress
```
Rows: Workshop Name
Columns:
  - Workshop Starts
  - Quiz Attempts
  - Quiz Pass Rate
  - Players Completing
```

### Report 3: Quest Success Rates
```
Rows: Quest Name, Difficulty
Columns:
  - Quest Starts
  - Quest Completions
  - Completion Rate (%)
  - Average XP Earned
  - Cosmetic Unlock Rate
```

### Report 4: Player Progression Segments
```
Rows: Player Level (custom dimension)
Columns:
  - Active Players Count
  - Average Games Played
  - Average XP
  - Churn Rate (no activity in 7 days)
```

---

## 📊 Real-Time Monitoring

Go to **Real-time** to see:
- Active users now
- Current page views
- Game starts happening live
- Quest completions in real-time
- Leaderboard activity

Watch for:
- `game_start` events spiking
- `quest_complete` converting to higher XP
- `cosmetic_unlock` engagement

---

## 🎯 Key Insights to Monitor

### Daily Metrics to Check
1. **Game Engagement**: Which games drive most sessions?
2. **Quest Completion Rate**: What's the quest funnel conversion?
3. **Player Level Distribution**: Are players progressing?
4. **Streak Maintenance**: What's the daily play percentage?
5. **Cosmetic Value**: Do cosmetics drive engagement?

### Weekly Analysis
- Game popularity trends
- Workshop completion rates by difficulty
- Quest difficulty balance (are advanced quests too hard?)
- Churn: players not returning
- Engagement velocity: are players speeding up?

### Monthly Goals
- Player retention (month-over-month)
- New player conversion (first game → first quest → first cosmetic)
- Content engagement (which platforms/types perform best?)
- Monetization (if applicable): cosmetic value to XP ratio

---

## 🔍 Advanced Queries (GA4 SQL Interface)

### Query 1: Top Games by Session Duration
```sql
SELECT 
  game_name,
  COUNT(DISTINCT session_id) as sessions,
  AVG(time_spent_seconds) as avg_duration
FROM events
WHERE event_name = 'game_end'
GROUP BY game_name
ORDER BY avg_duration DESC
```

### Query 2: Quest Completion Funnel
```sql
SELECT 
  quest_name,
  COUNT(CASE WHEN event_name = 'quest_start' THEN 1 END) as started,
  COUNT(CASE WHEN event_name = 'quest_complete' THEN 1 END) as completed,
  ROUND(100 * COUNT(CASE WHEN event_name = 'quest_complete' THEN 1 END) / 
        COUNT(CASE WHEN event_name = 'quest_start' THEN 1 END), 2) as completion_rate
FROM events
GROUP BY quest_name
```

### Query 3: Player Progression Cohorts
```sql
SELECT 
  user_properties.player_level,
  COUNT(DISTINCT user_id) as players,
  AVG(event_count) as avg_events_per_player
FROM events
GROUP BY user_properties.player_level
ORDER BY user_properties.player_level DESC
```

---

## 🚨 Important Notes

1. **Custom User ID**: Each player is tracked with a unique `ga4_user_id` stored in localStorage
2. **Session Tracking**: `session_id` parameter helps track user sessions across events
3. **Event Parameters**: All events include timestamp for time-based analysis
4. **Ecommerce**: Cosmetics tracked as $0 purchases (free rewards)
5. **Privacy**: GA4 configured with consent mode (`analytics_storage:'denied'` by default)

---

## 📱 Expected Data Flow

```
Game Start → Game Score Updates → Game End
             ↓
        Player XP Check
             ↓
        Workshop Start → Quiz Attempt → Workshop Complete
                ↓
            Quest Start → Quest Requirements Met → Quest Complete
                    ↓
            Cosmetic Unlock → Player Level Up
```

Each step is tracked separately so you can see where players drop off.

---

## 🎓 Next Steps

1. **Set up custom dimensions** (Step 1 above) — 10 minutes
2. **Create custom metrics** (Step 2 above) — 5 minutes
3. **Mark conversion goals** (Step 3 above) — 5 minutes
4. **Build dashboards** (4-5 reports) — 30 minutes
5. **Set alerts** for key metrics (optional) — 10 minutes

**Total setup time: ~1 hour**

Once set up, you'll have complete visibility into:
- Which games drive engagement
- Which quests convert best
- Where players drop off
- What difficulty sweet spots are
- How cosmetics impact retention

---

## 💡 Pro Tips

- **Use UTM parameters**: Link socially to `pages/quest-board.html?utm_source=twitter&utm_campaign=launch`
- **Create segments**: "Players Level 10+" vs "New Players" for A/B analysis
- **Set up alerts**: Alert when game_start spike exceeds 2x normal
- **Weekly exports**: Export weekly reports to track trends over time
- **Benchmark**: Set targets like "80% quest completion rate for beginner quests"

---

**Your GA4 is now ready to provide deep insights into player behavior!** 🚀
