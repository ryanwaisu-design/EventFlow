import { memo, useMemo } from 'react';
import { Crown, Minus, Plus } from 'lucide-react';
import SeatCell from './SeatCell';
import BanquetTableView from './BanquetTableView';
import type { Seat, SeatingPlan } from '../../types';
import { groupSeats, isBanquetLayout } from '../../utils/seatLayout';
import type { SeatingView } from '../../utils/seatingView';
import { sortSeatsPhysical } from '../../utils/rankOrder';
import { roundTableRowGap } from '../../utils/guestSeats';
import {
  buildFloorRowSegments,
  buildStageRowSegments,
  getRowAisleBreakAfterIndex,
  getRowAisleGap,
  getRowSeatsPerSegment,
  rowAisleWidthPx,
} from '../../utils/rowAisle';
import { buildGuestMap, getGuestFromMap } from '../../utils/guestLookup';
import {
  floorTableKey,
  getTableDisplayNumber,
  MAIN_TABLE_KEY,
  tableCoreLabel,
  tableTitleLabel,
} from '../../utils/tableNumber';
import type { SeatingMode } from '../../utils/guestSeats';
import { useSeatingWorkspaceStore } from '../../store/seatingWorkspaceStore';

export type SeatingToolbarMode = 'normal' | 'lock' | 'renumber' | 'aisle' | 'layout';

interface SeatingChartProps {
  view: SeatingView;
  plan: SeatingPlan;
  selectedSeatId: string | null;
  highlightGuestIds: string[];
  seatingMode: SeatingMode;
  toolbarMode: SeatingToolbarMode;
  dragDisabled: boolean;
  dndEnabled?: boolean;
  guestQuotaByGuestId?: Map<string, string>;
  aislePickSeatId?: string | null;
  onSeatClick: (seatId: string) => void;
  onTableClick?: (tableKey: string) => void;
  onRemoveGuest?: (seatId: string, e: React.MouseEvent) => void;
}

export default memo(function SeatingChart({
  view,
  plan,
  selectedSeatId,
  highlightGuestIds,
  seatingMode,
  toolbarMode,
  dragDisabled,
  dndEnabled = false,
  guestQuotaByGuestId,
  aislePickSeatId = null,
  onSeatClick,
  onTableClick,
  onRemoveGuest,
}: SeatingChartProps) {
  const {
    adjustRowSeats,
    adjustFloorRowSeats,
    adjustStageSeats,
    adjustTableSeats,
    adjustRowAisleGap,
    adjustRowSeatsPerSegment,
  } = useSeatingWorkspaceStore();
  const grouped = useMemo(() => groupSeats(view.seats), [view.seats]);
  const guestMap = useMemo(() => buildGuestMap(view.guests), [view.guests]);
  const highlightSet = useMemo(() => new Set(highlightGuestIds), [highlightGuestIds]);
  const banquet = isBanquetLayout(view);
  const tableShape = view.venueConfig.type === 'banquet' ? view.venueConfig.guestTableShape : 'round';
  const headTableShape =
    view.venueConfig.type === 'banquet' ? view.venueConfig.headTableShape : 'round';
  const stageOnly = view.venueConfig.type === 'stage';
  const seatsPerTable =
    view.venueConfig.type === 'banquet' ? view.venueConfig.seatsPerTable : 12;
  const venueConfig = view.venueConfig;
  const banquetConfig = venueConfig.type === 'banquet' ? venueConfig : null;
  const roundTableGapPx =
    tableShape === 'round' ? roundTableRowGap(seatsPerTable) : 8;

  const renderAisleSpacer = (row: number, zone: 'floor' | 'stage', key: string) => {
    const gap = getRowAisleGap(venueConfig, row, zone);
    if (gap <= 0) return null;
    return (
      <div
        key={key}
        className="banquet-table-aisle row-aisle"
        style={{ width: rowAisleWidthPx(gap), minWidth: rowAisleWidthPx(gap) }}
        title="走道"
        aria-label="走道"
      />
    );
  };

  const renderAisleControls = (
    row: number,
    zone: 'floor' | 'stage',
    options: { showSegments?: boolean } = {},
  ) => {
    const aisleGap = getRowAisleGap(venueConfig, row, zone);
    const seatsPerSegment = getRowSeatsPerSegment(venueConfig, row, zone);
    return (
      <>
        {options.showSegments && (
          <div className="row-adjust-group">
            <span className="row-adjust-label">每段</span>
            <div className="adjust-btns">
              <button
                type="button"
                onClick={() => adjustRowSeatsPerSegment(row, -1, zone)}
                title="減少每段座位（增加間斷）"
              >
                <Minus size={12} />
              </button>
              <span className="row-adjust-value">{seatsPerSegment || '—'}</span>
              <button
                type="button"
                onClick={() => adjustRowSeatsPerSegment(row, 1, zone)}
                title="增加每段座位（減少間斷）"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}
        <div className="row-adjust-group">
          <span className="row-adjust-label">走道</span>
          <div className="adjust-btns">
            <button
              type="button"
              onClick={() => adjustRowAisleGap(row, -1, zone)}
              title="縮窄走道"
            >
              <Minus size={12} />
            </button>
            <span className="row-adjust-value">{aisleGap}</span>
            <button
              type="button"
              onClick={() => adjustRowAisleGap(row, 1, zone)}
              title="加寬走道"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderSegmentedSeatRow = (
    row: number,
    zone: 'floor' | 'stage',
    seats: Seat[],
    rowClass: string,
  ) => {
    const segments =
      zone === 'stage'
        ? buildStageRowSegments(venueConfig, row, seats)
        : buildFloorRowSegments(venueConfig, row, seats);
    return (
      <div className={`seat-row seat-row-nowrap ${rowClass}`}>
        {segments.flatMap((segment, index) => {
          const nodes = [
            <div key={`${rowClass}-seg-${index}`} className="seat-row-segment">
              {renderSeats(segment, { row, zone })}
            </div>,
          ];
          if (index < segments.length - 1) {
            const spacer = renderAisleSpacer(row, zone, `${rowClass}-aisle-${index}`);
            if (spacer) nodes.push(spacer);
          }
          return nodes;
        })}
      </div>
    );
  };

  const floorTableRowStyle = (row: number): React.CSSProperties => {
    const aisleGap = banquetConfig ? getRowAisleGap(venueConfig, row, 'floor') : 0;
    return {
      display: 'flex',
      flexFlow: 'row nowrap',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: aisleGap > 0 ? '0.25rem' : `${roundTableGapPx}px`,
      width: '100%',
      maxWidth: '100%',
      margin: 0,
      padding: '0.15rem 0.1rem',
    };
  };

  const tableProps = {
    guestMap,
    assignments: view.assignments,
    showTooltip: view.showTooltip,
    guestQuotaByGuestId,
    selectedSeatId,
    highlightGuestIds,
    toolbarMode,
    dragDisabled,
    dndEnabled,
    onSeatClick,
    onRemoveGuest,
  };

  const renderSeat = (seat: Seat, aisleCtx?: { row: number; zone: 'floor' | 'stage' }) => {
    const assignment = view.assignments[seat.id];
    const guest = getGuestFromMap(guestMap, assignment?.guestId ?? null);
    const quotaLabel = guest ? guestQuotaByGuestId?.get(guest.id) : undefined;
    const breakAfter = aisleCtx
      ? getRowAisleBreakAfterIndex(venueConfig, aisleCtx.row, aisleCtx.zone).includes(seat.index)
      : false;
    return (
      <SeatCell
        key={seat.id}
        seat={seat}
        assignment={assignment}
        guest={guest}
        showTooltip={view.showTooltip}
        quotaLabel={quotaLabel}
        selected={selectedSeatId === seat.id}
        highlighted={!!guest && highlightSet.has(guest.id)}
        locked={assignment?.locked ?? false}
        toolbarMode={toolbarMode}
        dragDisabled={dragDisabled}
        dndEnabled={dndEnabled}
        aislePick={aislePickSeatId === seat.id}
        aisleBreakAfter={breakAfter}
        onClick={() => onSeatClick(seat.id)}
        onRemove={onRemoveGuest ? (e) => onRemoveGuest(seat.id, e) : undefined}
      />
    );
  };

  const renderSeats = (seats: Seat[], aisleCtx?: { row: number; zone: 'floor' | 'stage' }) =>
    seats.map((seat) => renderSeat(seat, aisleCtx));

  const showStage = Object.keys(grouped.stageByRow).length > 0;
  const showAudience = !stageOnly;

  return (
    <div className="seating-chart" id="seating-chart-export">
      {showStage && (
        <div className="seating-zone stage-zone">
          <div className="stage-backdrop">
            <span>舞台 / LED 顯示屏</span>
          </div>
          <h3 className="zone-label">台上 {seatingMode === 'stage' && <em className="mode-badge">編輯中</em>}</h3>
          <div className="stage-rows">
            {Object.entries(grouped.stageByRow)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([rowKey, seats]) => {
                const row = Number(rowKey);
                return (
                <div key={rowKey} className="floor-row-group stage-row-item">
                  <div className="row-controls no-print">
                    <span>
                      台上 第 {row + 1} 排
                      {row === 0 ? '（近台下）' : '（近舞台）'}
                    </span>
                    <div className="row-adjust-group">
                      <span className="row-adjust-label">座位</span>
                      <div className="adjust-btns">
                        <button type="button" onClick={() => adjustStageSeats(row, -1)} title="減少座位">
                          <Minus size={12} />
                        </button>
                        <button type="button" onClick={() => adjustStageSeats(row, 1)} title="增加座位">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    {renderAisleControls(row, 'stage', { showSegments: true })}
                  </div>
                  {renderSegmentedSeatRow(row, 'stage', seats, 'stage-row')}
                </div>
                );
              })}
          </div>
        </div>
      )}

      {showAudience && banquet && (grouped.main.length > 0 || Object.keys(grouped.floorByRowTable).length > 0) && (
        <div className="banquet-floor-plan">
          {grouped.main.length > 0 && (
            <div className="seating-zone">
              <h3 className="zone-label head-table-label">
                <Crown size={16} className="crown-icon" /> 主桌
              </h3>
              <div className="banquet-tables-row banquet-tables-row--centered">
                <BanquetTableView
                  tableLabel="主桌"
                  coreLabel="主桌"
                  isHeadTable
                  tableKey={MAIN_TABLE_KEY}
                  tableShape={headTableShape}
                  seats={grouped.main}
                  onAdjustSeats={(delta, side) => adjustTableSeats(MAIN_TABLE_KEY, delta, side)}
                  {...tableProps}
                />
              </div>
            </div>
          )}

          {Object.keys(grouped.floorByRowTable).length > 0 && (
            <div className="seating-zone">
              <h3 className="zone-label">
                台下 {seatingMode === 'audience' && <em className="mode-badge">編輯中</em>}
              </h3>
              {Object.entries(grouped.floorByRowTable)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([rowKey, tables]) => {
                  const row = Number(rowKey);
                  const aisleGap = getRowAisleGap(venueConfig, row, 'floor');
                  const tableEntries = Object.entries(tables).sort(([a], [b]) => Number(a) - Number(b));

                  return (
                  <div key={rowKey} className="floor-row-group">
                    <div className="row-controls no-print">
                      <span>第 {row + 1} 排</span>
                      <div className="row-adjust-group">
                        <span className="row-adjust-label">桌數</span>
                        <div className="adjust-btns">
                          <button type="button" onClick={() => adjustRowSeats(row, -1)} title="減少桌數">
                            <Minus size={12} />
                          </button>
                          <button type="button" onClick={() => adjustRowSeats(row, 1)} title="增加桌數">
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="row-adjust-group">
                        <span className="row-adjust-label">座位</span>
                        <div className="adjust-btns">
                          <button type="button" onClick={() => adjustFloorRowSeats(row, -1)} title="減少每桌座位">
                            <Minus size={12} />
                          </button>
                          <button type="button" onClick={() => adjustFloorRowSeats(row, 1)} title="增加每桌座位">
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="row-adjust-group">
                        <span className="row-adjust-label">走道</span>
                        <div className="adjust-btns">
                          <button type="button" onClick={() => adjustRowAisleGap(row, -1, 'floor')} title="縮窄枱間走道">
                            <Minus size={12} />
                          </button>
                          <span className="row-adjust-value">{aisleGap}</span>
                          <button type="button" onClick={() => adjustRowAisleGap(row, 1, 'floor')} title="加寬枱間走道">
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`banquet-tables-row banquet-tables-row--horizontal${tableShape === 'round' ? ' banquet-tables-row--round' : ''}`}
                      {...(tableShape === 'round' ? { 'data-table-shape': 'round' } : {})}
                      style={floorTableRowStyle(row)}
                    >
                      {tableEntries.flatMap(([tableKey, seats], tableIndex) => {
                        const num = getTableDisplayNumber(plan, row, Number(tableKey));
                        const key = floorTableKey(row, Number(tableKey));
                        const nodes = [
                          <BanquetTableView
                            key={tableKey}
                            tableLabel={tableTitleLabel(num)}
                            coreLabel={tableCoreLabel(num)}
                            tableKey={key}
                            tableNumber={tableShape === 'round' ? num : undefined}
                            tableShape={tableShape}
                            seats={sortSeatsPhysical(seats)}
                            onTableClick={onTableClick}
                            onAdjustSeats={(delta, side) => adjustTableSeats(key, delta, side)}
                            {...tableProps}
                          />,
                        ];
                        if (tableIndex < tableEntries.length - 1 && aisleGap > 0) {
                          nodes.push(
                            <div
                              key={`aisle-${row}-${tableKey}`}
                              className="banquet-table-aisle"
                              style={{
                                width: rowAisleWidthPx(aisleGap),
                                minWidth: rowAisleWidthPx(aisleGap),
                              }}
                              title="枱間走道"
                              aria-label="枱間走道"
                            />,
                          );
                        }
                        return nodes;
                      })}
                    </div>
                  </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {showAudience && grouped.main.length > 0 && !banquet && (
        <div className="seating-zone">
          <h3 className="zone-label head-table-label">
            <Crown size={16} className="crown-icon" /> 主桌
          </h3>
          <div className="seat-row seat-row-nowrap main-row">{renderSeats(grouped.main)}</div>
        </div>
      )}

      {showAudience &&
        !banquet &&
        Object.keys(grouped.floorByRow).length > 0 && (
          <div className="seating-zone">
            <h3 className="zone-label">
              台下 {seatingMode === 'audience' && <em className="mode-badge">編輯中</em>}
            </h3>
            {Object.entries(grouped.floorByRow)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([rowKey, seats]) => {
                const row = Number(rowKey);
                return (
                <div key={rowKey} className="floor-row-group">
                  <div className="row-controls no-print">
                    <span>第 {row + 1} 排</span>
                    <div className="row-adjust-group">
                      <span className="row-adjust-label">座位</span>
                      <div className="adjust-btns">
                        <button type="button" onClick={() => adjustFloorRowSeats(row, -1)} title="減少座位">
                          <Minus size={12} />
                        </button>
                        <button type="button" onClick={() => adjustFloorRowSeats(row, 1)} title="增加座位">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    {renderAisleControls(row, 'floor', { showSegments: true })}
                  </div>
                  {renderSegmentedSeatRow(row, 'floor', seats, 'theater-row')}
                </div>
                );
              })}
          </div>
        )}
    </div>
  );
});
