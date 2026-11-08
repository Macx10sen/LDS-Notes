/*
 * Note layouts, modeled on the paper notebook.
 *
 * Field types:
 *   line     single-line text            data[key] = string
 *   lines    lined, auto-growing text    data[key] = string
 *   checks   checkbox options (+ other)  data[key] = { selected: [], other: '' }
 *            detail: an extra line under the options, stored at data[detail.key]
 *            rerender: redraw the page when it changes (for dependent options)
 *   speakers list of name/topic(/notes)  data[key] = [{ name, topic, notes }]
 *            toggle: a checkbox in the heading, stored at data[toggle.key]
 *   hearHim  row of tap-to-fill circles  data[key] = number
 *   cta      Read / Pray / Share about   data[key] = { read:{on,text}, pray:{…}, share:{…} }
 *   choice   pick one option (segmented)  data[key] = option key
 *   blocks   the same fields repeated once per label, one shown at a time
 *            data[key] = [ {…fields for labels[0]}, {…fields for labels[1]} ]
 *            labels may be a function (d, long) => [labels], for labels that
 *            depend on the note (like the days of the study week)
 *
 * Any field may have show: (d) => boolean to hide it in some cases.
 *   row      children side by side on wide screens, stacked on phones
 *   col      children stacked (used inside a row)
 *
 * Every note also has data.date (and, unless the type's `when` says otherwise,
 * data.time and data.location), shown above the pages.
 */
(function () {
  'use strict';

  const GC_SESSIONS = [
    'Saturday Morning',
    'Saturday Afternoon',
    'Saturday Evening',
    'Sunday Morning',
    'Sunday Afternoon',
  ];
  const LOCAL_SESSIONS = ['Leadership Session', 'Adult Session', 'Sunday Session'];

  const STUDY_KINDS = [
    ['seminary', 'Seminary / Institute'],
    ['personal', 'Personal Study'],
  ];

  // Study weeks start on Monday, like the Come, Follow Me schedule.
  // Seminary / Institute meets Monday–Friday; personal study runs all 7 days.
  function studyDays(d) {
    return d.kind === 'seminary' ? 5 : 7;
  }

  function weekStart(d) {
    if (!d.date) return null;
    const [y, m, day] = d.date.split('-').map(Number);
    return new Date(y, m - 1, day);
  }

  function dayLabels(d, long) {
    const start = weekStart(d);
    return Array.from({ length: studyDays(d) }, (_, i) => {
      const date = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + i) : null;
      const weekday = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i];
      if (long) {
        return date
          ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
          : weekday;
      }
      return date
        ? `${date.toLocaleDateString(undefined, { weekday: 'short' })}\n${date.getDate()}`
        : weekday.slice(0, 3);
    });
  }

  // Which day tab to open first: today, if it falls in this week.
  function todayIndex(d) {
    const start = weekStart(d);
    if (!start) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today - start) / 86400000);
    return diff >= 0 && diff < studyDays(d) ? diff : 0;
  }

  window.SCHEMAS = {
    sunday: {
      label: 'Sunday',
      blurb: 'Sacrament Meeting & Second Hour',
      pages: [
        {
          title: 'Sacrament Meeting',
          short: 'Sacrament',
          fields: [
            {
              type: 'row',
              fields: [
                { type: 'lines', key: 'onMyMind', label: 'On My Mind', rows: 3 },
                { type: 'lines', key: 'onMyHeart', label: 'On My Heart', rows: 3 },
              ],
            },
            {
              type: 'speakers',
              key: 'speakers',
              label: 'Speakers',
              toggle: { key: 'testimonyMeeting', label: 'Testimony Meeting' },
            },
            {
              type: 'checks',
              key: 'music',
              label: 'Music',
              options: ['Musical Number', 'Primary Program'],
            },
            { type: 'lines', key: 'hymns', label: 'Hymns / Songs', rows: 2 },
            { type: 'lines', key: 'sacramentNotes', label: 'Notes / Impressions', rows: 10 },
            {
              type: 'row',
              fields: [
                { type: 'lines', key: 'sacramentForLater', label: 'For Later', rows: 3 },
                { type: 'lines', key: 'sacramentPromptings', label: 'Promptings / Takeaways', rows: 3 },
              ],
            },
            { type: 'hearHim', key: 'hearHim', label: 'Hear Him' },
          ],
        },
        {
          title: 'Second Hour',
          short: 'Second Hour',
          fields: [
            { type: 'lines', key: 'announcements', label: 'Announcements', rows: 2 },
            {
              type: 'blocks',
              key: 'blocks',
              labels: ['First Block', 'Second Block'],
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      type: 'col',
                      fields: [
                        {
                          type: 'checks',
                          key: 'class',
                          label: "Today's Class",
                          options: [
                            'Sunday School',
                            'Relief Society / Elders Quorum',
                            'Young Women / Young Men',
                          ],
                          other: true,
                          detail: { key: 'teacher', placeholder: 'Teacher' },
                        },
                        {
                          type: 'checks',
                          key: 'lesson',
                          label: "Today's Lesson",
                          options: ['Come, Follow Me', 'General Conference Talk'],
                          other: true,
                          detail: { key: 'lessonTitle', placeholder: 'Lesson or talk title' },
                        },
                      ],
                    },
                    { type: 'lines', key: 'somethingILoved', label: 'Something I Loved', rows: 5 },
                  ],
                },
                { type: 'lines', key: 'notes', label: 'Notes / Impressions', rows: 8 },
                { type: 'lines', key: 'promptings', label: 'Promptings / Takeaways', rows: 3 },
              ],
            },
            { type: 'lines', key: 'lookingForward', label: 'Looking Forward', rows: 3 },
            { type: 'cta', key: 'callToAction', label: 'Call to Action' },
          ],
        },
      ],
    },

    meeting: {
      label: 'Meeting',
      blurb: 'General, Stake & Ward Conference',
      pages: [
        {
          title: 'Meeting Notes',
          short: 'Meeting',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  type: 'col',
                  fields: [
                    { type: 'line', key: 'presiding', label: 'Presiding' },
                    {
                      type: 'checks',
                      key: 'conference',
                      label: 'Conference',
                      options: ['General Conference', 'Stake Conference', 'Ward Conference'],
                      other: true,
                      rerender: true,
                    },
                    {
                      type: 'checks',
                      key: 'session',
                      label: 'Session',
                      options: (d) =>
                        ((d.conference && d.conference.selected) || []).includes('General Conference')
                          ? GC_SESSIONS
                          : LOCAL_SESSIONS,
                      other: true,
                    },
                  ],
                },
                { type: 'lines', key: 'announcements', label: 'Announcements', rows: 5 },
              ],
            },
            { type: 'speakers', key: 'speakers', label: 'Speakers', notes: true },
            { type: 'lines', key: 'hymns', label: 'Music', sublabel: 'Hymns / Songs', rows: 2 },
            { type: 'lines', key: 'notes', label: 'Notes / Impressions', rows: 12 },
            { type: 'hearHim', key: 'hearHim', label: 'Hear Him' },
            {
              type: 'row',
              fields: [
                { type: 'lines', key: 'forLater', label: 'For Later', rows: 3 },
                { type: 'lines', key: 'invitations', label: 'Invitations / Promised Blessings', rows: 3 },
              ],
            },
            { type: 'lines', key: 'biggestTakeaways', label: 'Biggest Takeaways', rows: 3 },
            { type: 'cta', key: 'callToAction', label: 'Call to Action' },
          ],
        },
      ],
    },

    study: {
      label: 'Daily Study',
      blurb: 'Come, Follow Me · Seminary, Institute & personal study',
      kinds: STUDY_KINDS,
      when: { date: 'Week of', time: false, location: false },
      defaultBlock: todayIndex,
      pages: [
        {
          title: 'Come, Follow Me',
          short: 'Week',
          fields: [
            { type: 'choice', key: 'kind', label: 'Study', options: STUDY_KINDS },
            {
              type: 'line',
              key: 'cfmReading',
              label: 'Come, Follow Me',
              sublabel: "This week's reading",
              placeholder: 'e.g., Exodus 14–17',
            },
            { type: 'line', key: 'weekTitle', label: "This Week's Lesson", placeholder: 'Lesson title' },
            { type: 'line', key: 'teacher', label: 'Teacher', show: (d) => d.kind === 'seminary' },
            {
              type: 'blocks',
              key: 'days',
              labels: dayLabels,
              ariaLabel: 'Days of the week',
              tabClass: 'day-tabs',
              fields: [
                {
                  type: 'line',
                  key: 'scriptures',
                  label: "Today's Scriptures",
                  placeholder: 'e.g., Exodus 14:13–31',
                },
                { type: 'lines', key: 'notes', label: 'Notes / Impressions', rows: 8 },
                {
                  type: 'row',
                  fields: [
                    { type: 'lines', key: 'somethingILoved', label: 'Something I Loved', rows: 3 },
                    { type: 'lines', key: 'forLater', label: 'For Later', rows: 3 },
                  ],
                },
                { type: 'lines', key: 'promptings', label: 'Promptings / Takeaways', rows: 3 },
                { type: 'hearHim', key: 'hearHim', label: 'Hear Him' },
              ],
            },
            { type: 'lines', key: 'biggestTakeaways', label: 'Biggest Takeaways', sublabel: 'This week', rows: 3 },
            { type: 'cta', key: 'callToAction', label: 'Call to Action' },
          ],
        },
      ],
    },
  };
})();
