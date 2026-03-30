import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SOURCE_CHANNELS } from '../../triage/triage.constants';

const SOURCE_LIST = [...SOURCE_CHANNELS];

export class IntakeRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32_000)
  rawMessage!: string;

  @IsOptional()
  @IsString()
  @IsIn(SOURCE_LIST)
  source?: (typeof SOURCE_CHANNELS)[number];

  @IsOptional()
  @IsUUID('4')
  messageId?: string;
}
