-- 0002: SIIE camp nights per scout and activity (ScoutCampNight in src/app/models/scout.py).
CREATE TABLE scout_camp_nights (
	id VARCHAR NOT NULL, 
	"scoutId" VARCHAR NOT NULL, 
	"activityId" VARCHAR NOT NULL, 
	description VARCHAR NOT NULL, 
	"activityType" VARCHAR, 
	"startDate" DATETIME NOT NULL, 
	"endDate" DATETIME, 
	nights INTEGER DEFAULT 0 NOT NULL, 
	"campNights" INTEGER DEFAULT 0 NOT NULL, 
	"createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE ("scoutId", "activityId"), 
	FOREIGN KEY("scoutId") REFERENCES scouts (id) ON DELETE CASCADE
);

CREATE INDEX "scout_camp_nights_scoutId_idx" ON scout_camp_nights ("scoutId");
