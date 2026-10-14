/** Only server-acknowledged review tracks may own uploaded practice time. */
export const pendingStudyBatchSql = `
  WITH queued AS (
    SELECT rowid AS local_order, body,
      CASE
        WHEN json_extract(body,'$.kind')='reviewActivity'
          THEN coalesce(json_extract(body,'$.stepId'),'')
        WHEN json_extract(body,'$.kind')='audioActivity'
          AND json_extract(body,'$.lessonId')='review'
          THEN CASE WHEN json_extract(body,'$.stepId') LIKE 'review:%'
            THEN substr(json_extract(body,'$.stepId'),8) ELSE '' END
        ELSE NULL
      END AS required_review_track
    FROM study_events WHERE acknowledged=0
  )
  SELECT body FROM queued
  WHERE required_review_track IS NULL
     OR EXISTS (SELECT 1 FROM study_metadata
                WHERE key='review-ready:' || queued.required_review_track)
  ORDER BY local_order LIMIT 50
`;
