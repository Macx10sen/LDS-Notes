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
 *   row      children side by side on wide screens, stacked on phones
 *   col      children stacked (used inside a row)
 *
 * Every note also has data.date, data.time and data.location, shown above the pages.
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
                { type: 'lines', key: 'somethingILoved', label: 'Something I Loved', rows: 6 },
              ],
            },
            { type: 'lines', key: 'secondHourNotes', label: 'Notes / Impressions', rows: 8 },
            {
              type: 'row',
              fields: [
                { type: 'lines', key: 'secondHourPromptings', label: 'Promptings / Takeaways', rows: 3 },
                { type: 'lines', key: 'lookingForward', label: 'Looking Forward', rows: 3 },
              ],
            },
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
  };
})();
