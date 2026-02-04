import * as React from 'react';

const toTestId = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

const iconFactory = (name) => (props = {}) => {
  const testId = props['data-testid'] ?? toTestId(name);
  return React.createElement('svg', { ...props, 'data-icon': name, 'data-testid': testId });
};

export const AcademicCapIcon = iconFactory('AcademicCapIcon');
export const AdjustmentsHorizontalIcon = iconFactory('AdjustmentsHorizontalIcon');
export const ArrowDownIcon = iconFactory('ArrowDownIcon');
export const ArrowDownTrayIcon = iconFactory('ArrowDownTrayIcon');
export const ArrowLeftIcon = iconFactory('ArrowLeftIcon');
export const ArrowRightIcon = iconFactory('ArrowRightIcon');
export const ArrowTopRightOnSquareIcon = iconFactory('ArrowTopRightOnSquareIcon');
export const ArrowTrendingUpIcon = iconFactory('ArrowTrendingUpIcon');
export const ArrowUpIcon = iconFactory('ArrowUpIcon');
export const ArrowsRightLeftIcon = iconFactory('ArrowsRightLeftIcon');
export const ArrowsUpDownIcon = iconFactory('ArrowsUpDownIcon');
export const BanknotesIcon = iconFactory('BanknotesIcon');
export const Bars3Icon = iconFactory('Bars3Icon');
export const BellAlertIcon = iconFactory('BellAlertIcon');
export const BookmarkIcon = iconFactory('BookmarkIcon');
export const CalculatorIcon = iconFactory('CalculatorIcon');
export const CalendarDaysIcon = iconFactory('CalendarDaysIcon');
export const ChartBarIcon = iconFactory('ChartBarIcon');
export const ChartPieIcon = iconFactory('ChartPieIcon');
export const ChatBubbleBottomCenterTextIcon = iconFactory('ChatBubbleBottomCenterTextIcon');
export const ChatBubbleLeftIcon = iconFactory('ChatBubbleLeftIcon');
export const ChatBubbleLeftRightIcon = iconFactory('ChatBubbleLeftRightIcon');
export const ChatBubbleOvalLeftEllipsisIcon = iconFactory('ChatBubbleOvalLeftEllipsisIcon');
export const CheckCircleIcon = iconFactory('CheckCircleIcon');
export const CheckIcon = iconFactory('CheckIcon');
export const ChevronDownIcon = iconFactory('ChevronDownIcon');
export const ChevronLeftIcon = iconFactory('ChevronLeftIcon');
export const ChevronRightIcon = iconFactory('ChevronRightIcon');
export const ChevronUpIcon = iconFactory('ChevronUpIcon');
export const ClipboardDocumentCheckIcon = iconFactory('ClipboardDocumentCheckIcon');
export const ClipboardDocumentIcon = iconFactory('ClipboardDocumentIcon');
export const ClipboardDocumentListIcon = iconFactory('ClipboardDocumentListIcon');
export const ClipboardIcon = iconFactory('ClipboardIcon');
export const ClockIcon = iconFactory('ClockIcon');
export const CpuChipIcon = iconFactory('CpuChipIcon');
export const CreditCardIcon = iconFactory('CreditCardIcon');
export const CurrencyDollarIcon = iconFactory('CurrencyDollarIcon');
export const DocumentMagnifyingGlassIcon = iconFactory('DocumentMagnifyingGlassIcon');
export const ExclamationCircleIcon = iconFactory('ExclamationCircleIcon');
export const ExclamationTriangleIcon = iconFactory('ExclamationTriangleIcon');
export const EyeIcon = iconFactory('EyeIcon');
export const FireIcon = iconFactory('FireIcon');
export const FunnelIcon = iconFactory('FunnelIcon');
export const HeartIcon = iconFactory('HeartIcon');
export const HomeIcon = iconFactory('HomeIcon');
export const InboxIcon = iconFactory('InboxIcon');
export const InformationCircleIcon = iconFactory('InformationCircleIcon');
export const LightBulbIcon = iconFactory('LightBulbIcon');
export const LinkIcon = iconFactory('LinkIcon');
export const LockClosedIcon = iconFactory('LockClosedIcon');
export const MagnifyingGlassCircleIcon = iconFactory('MagnifyingGlassCircleIcon');
export const MagnifyingGlassIcon = iconFactory('MagnifyingGlassIcon');
export const MapPinIcon = iconFactory('MapPinIcon');
export const MegaphoneIcon = iconFactory('MegaphoneIcon');
export const NoSymbolIcon = iconFactory('NoSymbolIcon');
export const PencilIcon = iconFactory('PencilIcon');
export const PencilSquareIcon = iconFactory('PencilSquareIcon');
export const PlayCircleIcon = iconFactory('PlayCircleIcon');
export const PlayIcon = iconFactory('PlayIcon');
export const PlusIcon = iconFactory('PlusIcon');
export const PresentationChartLineIcon = iconFactory('PresentationChartLineIcon');
export const RectangleGroupIcon = iconFactory('RectangleGroupIcon');
export const RocketLaunchIcon = iconFactory('RocketLaunchIcon');
export const ShareIcon = iconFactory('ShareIcon');
export const SparklesIcon = iconFactory('SparklesIcon');
export const TableCellsIcon = iconFactory('TableCellsIcon');
export const TagIcon = iconFactory('TagIcon');
export const TrashIcon = iconFactory('TrashIcon');
export const TrophyIcon = iconFactory('TrophyIcon');
export const UserCircleIcon = iconFactory('UserCircleIcon');
export const UserGroupIcon = iconFactory('UserGroupIcon');
export const UserMinusIcon = iconFactory('UserMinusIcon');
export const UsersIcon = iconFactory('UsersIcon');
export const XCircleIcon = iconFactory('XCircleIcon');
export const XMarkIcon = iconFactory('XMarkIcon');

const icons = {
  AcademicCapIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  ArrowTrendingUpIcon,
  ArrowUpIcon,
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
  BanknotesIcon,
  Bars3Icon,
  BellAlertIcon,
  BookmarkIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChartPieIcon,
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentListIcon,
  ClipboardIcon,
  ClockIcon,
  CpuChipIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FireIcon,
  FunnelIcon,
  HeartIcon,
  HomeIcon,
  InboxIcon,
  InformationCircleIcon,
  LightBulbIcon,
  LinkIcon,
  LockClosedIcon,
  MagnifyingGlassCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MegaphoneIcon,
  NoSymbolIcon,
  PencilIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  PlayIcon,
  PlusIcon,
  PresentationChartLineIcon,
  RectangleGroupIcon,
  RocketLaunchIcon,
  ShareIcon,
  SparklesIcon,
  TableCellsIcon,
  TagIcon,
  TrashIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserMinusIcon,
  UsersIcon,
  XCircleIcon,
  XMarkIcon,
};

export default icons;
