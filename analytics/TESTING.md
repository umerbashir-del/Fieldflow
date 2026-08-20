# Analytics testing checklist

Run automated checks from the FieldFlow folder:

```text
npm run test --workspace=@fieldflow/analytics
npm run build --workspace=@fieldflow/analytics
```

Then check the local page manually:

1. Refresh `http://127.0.0.1:5173/`.
2. Select **This week**, **Last week**, and **Last 4 weeks**. Confirm that the cards, donut, and line graph update together.
3. With **This week** selected, confirm 14 jobs, 11 in the previous week, +27%, 5 new clients, and 4 repeat clients.
4. With **Last 4 weeks** selected, confirm the line graph reads 8, 10, 11, and 14.
5. Click **Copy summary for Chat**, paste into a text field, and confirm the copied figures match the page.
6. Click **Open selected jobs in Scheduling**. Confirm its address includes `account_id`, `start`, and `end`. Scheduling will apply those filters once its owner adds support for them.

The automated tests cover calculations, timeframe changes, account isolation, empty data, cancelled jobs, the Scheduling handoff link, and Chat summary text.
