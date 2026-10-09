-- CreateTable
CREATE TABLE "NumberSequenceCounter" (
    "sequenceKey" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequenceCounter_pkey" PRIMARY KEY ("sequenceKey","period")
);


ALTER TABLE "NumberSequenceCounter" ADD CONSTRAINT "NumberSequenceCounter_key_format"
  CHECK ("sequenceKey" ~ '^[a-z]+(\.[a-z_]+)+$');
ALTER TABLE "NumberSequenceCounter" ADD CONSTRAINT "NumberSequenceCounter_value_positive" CHECK ("lastValue" >= 1);
ALTER TABLE "NumberSequenceCounter" ENABLE ROW LEVEL SECURITY;
