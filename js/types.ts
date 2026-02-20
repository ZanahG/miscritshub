export interface MiscritData {
    id?: number | string;
    name: string;
    elements: string[];
    stats?: MiscritStats;
    baseStats?: MiscritStats;
    attacks?: MoveData[];
    enhancedAttacks?: MoveData[];
    avatar?: string;
}

export interface MiscritStats {
    HP: number;
    EA: number;
    PA: number;
    ED: number;
    PD: number;
    SPD: number;
    [key: string]: number; // Allow lowercase variations
}

export interface MoveData {
    name: string;
    element: string;
    ap: number;
    hits?: number;
}

export interface RelicData {
    name: string;
    icon?: string;
    level: number;
    stats: MiscritStats;
}

export interface MetaData {
    name: string;
    avatar?: string;
    elements?: string[];
}

export interface BaseStatsData {
    name: string;
    baseStats?: MiscritStats;
    stats?: MiscritStats;
    base?: MiscritStats;
    base_stats?: MiscritStats;
}
