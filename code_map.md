# Code Map
*Living doc. Update on structural changes.*

## Architecture
- App: React Native (Expo Web/Mobile) + TypeScript
- Backend: Firebase (Cloud Firestore)

## Files
- `src/navigation/AppNavigator.tsx`: Custom top tab bar & navigation stack (Dashboard, Calendario, Rutas, Nueva Cita, Clientes, Servicios).
- `src/screens/DashboardScreen.tsx`: Executive dashboard (billing, services analysis, schedule efficiency, client growth).
- `src/screens/CalendarScreen.tsx`: Multi-column daily view by team, conflict alerts, budget, call buttons.
- `src/screens/RouteScreen.tsx`: Daily itinerary with team filter, direct phone call button, multi-stop Google Maps URL.
- `src/screens/AppointmentsScreen.tsx`: Booking, phone lookup, client autofill, address validation, AI slot optimizer, budget.
- `src/screens/ClientsScreen.tsx`: Client database (CRM), search by phone/name, total revenue, full service history.
- `src/screens/ServicesScreen.tsx`: CRUD services catalog (name, duration, base price).
- `src/config/firebase.ts`: Firebase configuration & db init.
- `App.tsx`: Main entry point.
