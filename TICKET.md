# RES-5108: nobody could book a room for 35 minutes

| | |
|---|---|
| Status | Closed, follow-up open |
| Severity | S1 (customer facing, service unavailable) |
| Opened | 2026-11-04 by H. Ahmad, campus operations |
| Component | Campus room reservations |
| Window | 2026-11-04, 13:12 to 13:47 |

## What happened

On Wednesday the search cluster went down at 13:12. That was expected. The
search team was rolling a new node into the cluster and had told us the
room-finder page would be blank for half an hour. What we did not expect is
that the reservations page stopped taking bookings at 13:12 as well. Every
attempt came back as an error, from the web page and from the front-desk kiosk
alike. Twenty-two booking attempts failed in the window, and the front desk
took names on paper for the ones they could not put through. Cancellations kept
working the whole time, and the confirmation mail for bookings made before
13:12 went out normally.

Bookings started working again at 13:47, within a minute of the search cluster
coming back, without anybody touching the reservations service. So the two
outages are the same outage, and we would like to know why.

## What we need

The search team runs this maintenance monthly, and the next window is already
on the calendar. We need to know what booking a room needs from the search
cluster, and whether it really needs it.
