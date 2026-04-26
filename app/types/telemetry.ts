export interface FlightPath {
  coordinates: [number, number][];

  start_datetime_utc: string;
  end_datetime_utc: string;

  total_distance_km: number;
  total_duration_seconds: number;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
}
